import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import pkg_resources
import os

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        # This needs to be implemented
        self.finish(pkg_resources.resource_stream("jupyterlab_dosbox",
                os.path.join("bundles", "a1.jsdos")).read())

class RouteHandlerChanged(APIHandler):
    @tornado.web.authenticated
    def get(self):
        # This needs to be implemented
        self.finish(pkg_resources.resource_stream("jupyterlab_dosbox",
                os.path.join("bundles", "a1.jsdos.changed")).read())

class RouteWasmHandler(APIHandler):
    @tornado.web.authenticated
    def get(self, mod, extension):
        self.finish(pkg_resources.resource_stream("jupyterlab_dosbox",
                os.path.join("bundles", mod + "." + extension)).read())


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyterlab_dosbox", "bundles", "a1.jsdos")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
    # This is embarassing!  Why have two handlers when we could do with one?!?
    route_pattern_changed = url_path_join(base_url, "jupyterlab_dosbox", "bundles", "a1.jsdos.changed")
    handlers_changed = [(route_pattern_changed, RouteHandlerChanged)]
    web_app.add_handlers(host_pattern, handlers_changed)

    route_wasm_modules = url_path_join(base_url, "jupyterlab_dosbox", "wasm", "(.*).(js|wasm)")
    handlers_wasm = [(route_wasm_modules, RouteWasmHandler)]
    web_app.add_handlers(host_pattern, handlers_wasm)
