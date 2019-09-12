const fs = require('fs');
const path = require('path');

const VirtualModulesPlugin = require('webpack-virtual-modules');

class VirtualDirectoryPlugin extends VirtualModulesPlugin {
  constructor(paths) {
    super({});
    //paths => { target: source }

    //lookup all files
    Object.keys(paths).forEach(targetDirectory => {
      walk(paths[targetDirectory], file => {
        const target = targetDirectory + file.substr(paths[targetDirectory].length);
        this._staticModules[target] = fs.readFileSync(file);
        const meta = path.parse(target);
        const index = meta.dir + '.js'
        if (meta.name !== 'index' || this._staticModules[index]) {
          return;
        }

        //the rest of this patches for index.js which is not considered
        // in the VirtualModulesPlugin (I actually already asked)
        // https://github.com/sysgears/webpack-virtual-modules/issues/30

        //what we are doing here is creating a ./module/name.js for
        // ./module/name/index.js then updating any ./ reference with ./name/

        //this is a rudementary solution, so lets hope it doesnt get more
        //complicated than this.

        const last = meta.dir.split(path.sep).pop();
        this._staticModules[index] = this._staticModules[target]
          .toString().replace(/\.\//g, './' + last + '/');
      })
    });
  }
}

module.exports = VirtualDirectoryPlugin;

function walk(folder, callback) {
  const files = fs.readdirSync(folder);

  for (const file of files) {
    const item = path.join(folder, file);
    if (fs.statSync(item).isDirectory()) {
      walk(item, callback);
    } else {
      callback(item);
    }
  }
}
