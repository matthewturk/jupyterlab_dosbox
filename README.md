# jupyterlab_dosbox

![Github Actions Status](https://github.com/matthewturk/jupyterlab_dosbox/workflows/Build/badge.svg)

![Dosbox in Jupyterlab](https://i.imgur.com/GW5RNOh.png)

<!-- Binder disabled until I figure out server extensions on it -->
<!-- [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/matthewturk/jupyterlab_dosbox/main?urlpath=lab/tree/examples%2Fdosbox_coredump.ipynb) -->

Run DosBox in jupyterlab.  Built on [js-dos](https://js-dos/) and uses the js-dos 7.xx modules.

This exposes a pretty simple interface to a WASM-compiled DosBox instance.  You can get screenshots, coredumps, and you can send commands.  It will download some wasm assets off the web using pooch.

### As of right now, the DosBox instance does **not** listen to key and mouse events!

The examples in the `examples` directory show how to get a coredump, take a screenshot, and send zip files.

 * [Taking a screenshot](examples/screenshot.ipynb)
 * [Sending a zip and taking a coredump](examples/dosbox_coredump.ipynb)

There are a bunch of rough edges!  But, you can browse the files in your filesystem with a file browser panel on the left, and you can inspect the memory.

Some things that are on the roadmap:

 * Better interaction with the instance, including trapping and sending appropriate browser events
 * Saving and restoring file system and memory instances (i.e., machine state)
 * Better interface for inspecting core dumps
 * Sound and video capture
 * All-around polish on the interface (like, why aren't there any icons?!)

## Requirements

* JupyterLab >= 3.0
* [Pooch](https://fatiando.org/pooch/)
* numpy, for memory access

## Install

```bash
pip install jupyterlab_dosbox
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab_dosbox directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Uninstall

```bash
pip uninstall jupyterlab_dosbox
```
