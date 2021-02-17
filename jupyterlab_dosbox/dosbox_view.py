from ._version import __version__
import ipywidgets
import traitlets
from ipywidgets.widgets.trait_types import bytes_serialization
import numpy as np

EXTENSION_VERSION = __version__

@ipywidgets.register
class DosboxModel(ipywidgets.DOMWidget):
    _model_name = traitlets.Unicode('DosboxRuntimeModel').tag(sync=True)
    _model_module = traitlets.Unicode('jupyterlab-dosbox').tag(sync=True)
    _model_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    _view_name = traitlets.Unicode('DosboxRuntimeView').tag(sync=True)
    _view_module = traitlets.Unicode('jupyterlab-dosbox').tag(sync=True)
    _view_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    activelayer = traitlets.Unicode('default').tag(sync=True)
    _last_screenshot = traitlets.Bytes(allow_none=True).tag(sync=True, **bytes_serialization)

    def send_line(self, line):
        command = {'name': 'sendKeys', 'args': ["KBD_%s" % _.lower() for _ in
        line]}
        self.send(command)

    def screenshot(self):
        self.send({'name': 'screenshot', 'args': []})
    
    @property
    def last_screenshot(self):
        if self._last_screenshot is None or len(self._last_screenshot) == 0: return None
        return np.frombuffer(self._last_screenshot, dtype="u1").reshape((400,640, 4))