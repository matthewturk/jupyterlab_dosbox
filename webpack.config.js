var webpack = require("webpack");
module.exports = {
    experiments: {
        topLevelAwait: true,
        asyncWebAssembly: true,
    },
     plugins: [
         // This is just a way to make this not happen.  From what I can tell,
         // emulators.cacheSeed is modifying the value on an interface, since
         // it doesn't touch the emulators-impl.  I'm sure there's a better way
         // to do this.  But I can't seem to figure it out.
         new webpack.DefinePlugin({
             'emulators.cacheSeed': webpack.DefinePlugin.runtimeValue(() => "window.title")
         }),
     ]
}
