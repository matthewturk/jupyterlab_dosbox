import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import pkg_resources
import os
import io
import zipfile

import pooch

_wasm_filenames = {
    'wdirect.wasm': ('https://unpkg.com/emulators@0.0.55/dist/wdirect.wasm',
            '11bff62af123a3e693ceef43bc47ba7ba7aeea53a28f4a3c9772954b4d0d982a'),
    'wdirect.js': ('https://unpkg.com/emulators@0.0.55/dist/wdirect.js',
            '6c94981b57b0c8ffa8d410f134a6342a2ad3420319c1cb6738b1c445e1756959')
}

from .utils import make_zipfile

_default_components = ['dosbox.conf', 'jsdos.json']

DEFAULT_ZIP = {}

def _generate_zip(bundle_name = "bundle"):
    if bundle_name in DEFAULT_ZIP:
        return DEFAULT_ZIP[bundle_name]
    _b = io.BytesIO()
    with zipfile.ZipFile(_b, "w") as f:
        f.writestr(".jsdos/", "")
        for fn in _default_components:
            data = pkg_resources.resource_stream("jupyterlab_dosbox",
                    os.path.join("bundles", fn)).read()
            f.writestr(os.path.join(".jsdos", fn), data)
    _b.seek(0)
    DEFAULT_ZIP[bundle_name] = _b.read()
    return DEFAULT_ZIP[bundle_name]

if __name__ == "__main__":
    with open("null_bundle.zip", "wb") as f:
        f.write(_generate_zip())

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self, *args, **kwargs):
        # This needs to be implemented
        filenames = {}
        for fn in _default_components:
            data = pkg_resources.resource_stream("jupyterlab_dosbox",
                    os.path.join("bundles", fn)).read()
            filenames[os.path.join(".jsdos", fn)] = data
        self.finish(make_zipfile(filenames))

class RouteWasmHandler(APIHandler):
    @tornado.web.authenticated
    def get(self, mod, extension):
        fn = mod + "." + extension
        if fn not in _wasm_filenames:
            self.send_error(404)
        rpath = pkg_resources.resource_filename("jupyterlab_dosbox", "bundles")
        lfn = pooch.retrieve(*_wasm_filenames[fn], path = rpath)
        self.finish(open(lfn, "rb").read())


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyterlab_dosbox", "bundles", "null_bundle.jsdos(\.changed)?")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)

    route_wasm_modules = url_path_join(base_url, "jupyterlab_dosbox", "wasm", "(.*).(js|wasm)")
    handlers_wasm = [(route_wasm_modules, RouteWasmHandler)]
    web_app.add_handlers(host_pattern, handlers_wasm)
