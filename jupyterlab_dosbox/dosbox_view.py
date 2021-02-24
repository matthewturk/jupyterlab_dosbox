from ipython_genutils.py3compat import buffer_to_bytes
from ._version import __version__
from .utils import KEYCODES, make_zipfile
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
    _last_coredump = traitlets.Bytes(allow_none=True).tag(sync=True, **bytes_serialization)
    _last_registerdump = traitlets.Dict(allow_none=True).tag(sync=True)

    def send_characters(self, characters):
        keycodes = []
        for c in characters:
            keycodes.append( ("KBD_%s" % c.lower(), True ))
            keycodes.append( ("KBD_%s" % c.lower(), False ))
        command = {'name': 'sendKeys', 'args': keycodes}
        self.send(command)

    def send_command(self, command_str):
        # We need to parse each component of the command string
        # Not super-duper happy with this, but it'll do for now.
        if not command_str.endswith("\n"):
            command_str = command_str + "\n"
        keycodes = []
        # Only support leftshift for now
        is_shifted = False
        for c in command_str:
            if c == "\n":
                if is_shifted:
                    is_shifted = False
                    keycodes.append(("KBD_leftshift", False))
                keycodes.append(("KBD_enter", True))
                keycodes.append(("KBD_enter", False))
            elif c in KEYCODES:
                upper, key = KEYCODES[c]
                if upper and not is_shifted:
                    is_shifted = True
                    keycodes.append(("KBD_leftshift", True))
                elif not upper and is_shifted:
                    is_shifted = False
                    keycodes.append(("KBD_leftshift", False))
                keycodes.append(("KBD_%s" % key.lower(), True))
                keycodes.append(("KBD_%s" % key.lower(), False))
        self.send({'name': 'sendKeys', 'args': keycodes})

    def send_files(self, filenames):
        buffer = make_zipfile(filenames)
        print(f"Sending buffer of length {len(buffer):0.3e} bytes")
        self.send({'name': 'sendZipfile', 'args': []}, [buffer])

    def screenshot(self):
        self.send({'name': 'screenshot', 'args': []})

    def coredump(self, full_memory = True):
        self.send({'name': 'coreDump', 'args': [full_memory]})

    def pop_out(self):
        self.send({'name': 'popOut', 'args': []})
    
    @property
    def last_coredump(self):
        if self._last_coredump is None or len(self._last_coredump) == 0: return None
        return np.frombuffer(self._last_coredump, dtype="u1")

    @property
    def last_screenshot(self):
        if self._last_screenshot is None or len(self._last_screenshot) == 0: return None
        return np.frombuffer(self._last_screenshot, dtype="u1").reshape((400,640, 4))
