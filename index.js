const fs = require('fs');
const path = require('path');

const VirtualModulesPlugin = require('webpack-virtual-modules');
const VirtualStats = require('./VirtualStats');

class VirtualFoldersPlugin extends VirtualModulesPlugin {
  /**
   * Plugin Loader
   *
   * @param {Object} config
   *
   * @return {VirtualFoldersPlugin}
   */
  static load(config) {
    return new VirtualFoldersPlugin(config);
  }

  /**
   * Organizes the config
   *
   * @param {Object} config
   */
  constructor(config) {
    super({});

    // config can be setup like this
    //config => { target: source }
    this._virtualFolders = config;

    // it can also look like this
    //config => { files: {}, folders: {} }
    if (config.files || config.folders) {
      this._virtualFolders = {};
    }

    //if it's the latter, set up the files and folders separately
    if (config.folders) {
      this._virtualFolders = config.folders;
    }

    //VirtualModulesPlugin does not solve for folder reading
    //we need to mark these separately in order to handle them
    //properly
    this._virtualFiles = {};
    if (config.files) {
      for (const file in config.files) {
        this.addStringFile(file, config.files[file]);
      }
    }
  }

  /**
   * This has the same effect as using VirtualModulesPlugin
   * except it handles the folder when webpack calls on readdir
   *
   * @param {String} file
   * @param {(String|Buffer)} content
   *
   * @return {VirtualFoldersPlugin}
   */
  addStringFile(file, content) {
    //just add to the file list
    this._virtualFiles[file] = content;

    const folder = path.dirname(file);

    //if the folder exists, it will be taken care of by webpack
    if (fs.existsSync(folder)) {
      //so no need to do anything else
      return this;
    }

    //if we are here, the folder does not exist
    //we need to store the file name and size in a particular format..

    //if the folder name does not exist
    if (typeof this._virtualFolders[folder] === 'undefined') {
      //create one
      this._virtualFolders[folder] = [];
    }

    //either way push the associated file into this folder reference
    //this is the exact same format expected by _addFolder()
    this._virtualFolders[folder].push({
      file: file,
      size: content.length
    });

    return this;
  }

  /**
   * This is the entry point for a webpack plugin
   *
   * @param {Compiler} compiler
   *
   * @return {VirtualFoldersPlugin}
   */
  apply(compiler) {
    compiler.hooks.afterEnvironment.tap(
      'VirtualFoldersPlugin',
      this._bindPurge.bind(this, compiler)
    );

    compiler.hooks.afterPlugins.tap(
      'VirtualFoldersPlugin',
      this._bindPaths.bind(this)
    );

    super.apply(compiler);
  }

  /**
   * Used by _bindPaths(), this copies each file from the real file system
   * over to the virtual directory target
   *
   * @param {Compiler} compiler
   * @param {String} folder - the target directory
   * @param {String} file
   *
   * @return {Object} [{ file, size }]
   */
  _addFile(compiler, folder, file) {
    //form the target file
    const target = folder + file.substr(this._virtualFolders[folder].length);

    //get the contents (prefer a buffer)
    this._virtualFiles[target] = fs.readFileSync(file);

    //parse the target for its file meta properties
    const meta = path.parse(target);

    //we need to see if this is an index file to solve
    //for a VirtualModulesPlugin quirk described below
    const index = meta.dir + '.js';
    const size = this._virtualFiles[target].length || 0;

    //if base name is not index or index exists
    if (meta.name === 'index' && !this._virtualFiles[index]) {
      //the rest of this patches for index.js which is not considered
      // in the VirtualModulesPlugin (I actually already asked)
      // https://github.com/sysgears/webpack-virtual-modules/issues/30

      //what we are doing here is creating a ./module/name.js for
      // ./module/name/index.js then updating any ./ reference with ./name/

      //this is a rudementary solution, so lets hope it doesnt get more
      //complicated than this.

      const last = meta.dir.split(path.sep).pop();
      this._virtualFiles[index] = this._virtualFiles[target]
        .toString().replace(/\.\//g, './' + last + '/');
    }

    //this is the exact same format expected by _addFolder()
    return { file, size };
  }

  /**
   * Used by _bindPaths(), this creates a stat for the given folder whether
   * if it's a real folder or not. This also fixes for "folder not found"
   * issues by properly adding virtual folders to the compiler's _readdirStorage
   * in which the compiler's readdir() retrieves stats from.
   *
   * @param {Compiler} compiler
   * @param {String} folder - the target directory
   * @param {Object} meta - this is an array of { file, size }
   */
  _addFolder(compiler, folder, meta) {
    //this is used to figure out the folder size
    let length = 0;
    //this is a list of files we need to provide for _readdirStorage
    // in order for readdir() to properly work
    const files = [];

    //populate length and files
    for (const { file, size } of meta) {
      length += size;
      files.push(path.basename(file));
    }

    //this block is simply setting the Virtual Stats for the folder
    const time = Date.now();
    const stats = new VirtualStats({
      dev: 16777220,
      nlink: 0,
      uid: 1000,
      gid: 1000,
      rdev: 0,
      blksize: 4096,
      mode: 16877,
      size: length,
      blocks: 0,
      atime: time,
      mtime: time,
      ctime: time,
      birthtime: time
    });

    //make sure we log an absolute folder
    if (!path.isAbsolute(folder)) {
      folder = path.join(compiler.context, folder);
    }

    //add to the stat storage
    const statStorage = compiler.inputFileSystem._statStorage;
    if (statStorage.data instanceof Map) {
      statStorage.data.set(folder, [null, stats]);
    } else {
      //webpack 3
      statStorage.data[folder] = [null, stats];
    }

    //add to the dir storage
    const dirStorage = compiler.inputFileSystem._readdirStorage;
    if (dirStorage.data instanceof Map) {
      dirStorage.data.set(folder, [null, files]);
    } else {
      //webpack 3
      dirStorage.data[folder] = [null, files];
    }
  }

  /**
   * Used by apply(), this adds all the files and folders to webpack's
   * compiler file system. uses _addFile() and _addFolder().
   *
   * @param {Compiler} compiler
   */
  _bindPaths(compiler) {
    //lookup all folders
    Object.keys(this._virtualFolders).forEach(folder => {
      //if /some/path is an array
      if(this._virtualFolders[folder] instanceof Array) {
        //this can only come from addStringFile()
        //which implies that the folder isn't a real folder.
        this._addFolder(compiler, folder, this._virtualFolders[folder]);
        return;
      }

      //otherwise, lets try to walk it.
      walk(
        this._virtualFolders[folder],
        this._addFile.bind(this, compiler, folder),
        this._addFolder.bind(this, compiler)
      );
    });

    //VirtualModulesPlugin deletes _staticModules,
    // but the modules are needed to rebuild the folders...
    this._staticModules = Object.assign({}, this._virtualFiles);
  }

  /**
   * Used by apply(), VirtualModulesPlugin overwrites webpack's compiler
   * filesystem purge, in the same regard, when a purge is called we also
   * need to repopulate the stat storage.
   *
   * @param {Compiler} compiler
   */
  _bindPurge(compiler) {
    const self = this;

    var originalPurge = compiler.inputFileSystem.purge;
    compiler.inputFileSystem.purge = function() {
      originalPurge.apply(this, arguments);
      self._bindPaths(compiler);
    };
  }
}

module.exports = VirtualFoldersPlugin;

/**
 * Helper to walk through each file in a specific way
 *
 * @param {String} folder
 * @param {Function} callbackForFiles
 * @param {Function} callbackForFolders
 */
function walk(folder, callbackForFiles, callbackForFolders) {
  const files = fs.readdirSync(folder);

  const meta = [];
  for (const file of files) {
    const item = path.join(folder, file);
    if (fs.statSync(item).isDirectory()) {
      walk(item, callbackForFiles, callbackForFolders);
      //call folders after walk so we can determine the size
      callbackForFolders(item, meta);
    } else {
      meta.push(callbackForFiles(item) || {});
    }
  }
}
