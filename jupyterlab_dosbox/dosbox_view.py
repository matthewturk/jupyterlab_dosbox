from ._version import __version__
import ipywidgets
import traitlets

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

    def send_line(self, line):
        command = {'name': 'sendKeys', 'args': ["KBD_%s" % _.lower() for _ in
        line]}
        self.send(command)