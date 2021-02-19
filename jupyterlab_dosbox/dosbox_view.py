from ipython_genutils.py3compat import buffer_to_bytes
from ._version import __version__
import ipywidgets
import traitlets
from ipywidgets.widgets.trait_types import bytes_serialization
import numpy as np
import string

EXTENSION_VERSION = __version__

_KEYS = {
    "\t": "tab",
    " ": "space",
    #public KBD_grave = 96;
    "-": "minus",
    "=": "equals",
    "\\": "backslash",
    "[": "leftbracket",
    "]": "rightbracket",
    ";": "semicolon",
    "'": "quote",
    "." : "period",
    "," : "comma",
    "/" : "slash",
    "!" : ["shift", "1"],
    "@":  ["shift", "2"],
    "#": ["shift", "3"],
    "$": ["shift", "4"],
    "%": ["shift", "5"],
    "^": ["shift", "6"],
    "&": ["shift", "7"],
    "*": ["shift", "8"],
    "(": ["shift", "9"],
    ")": ["shift", "0"],
    "_": ["shift", "minus"],
    "+": ["shift", "equals"],
    "{": ["shift", "leftbracket"],
    "}": ["shift", "rightbracket"],
    "|": ["shift", "backslash"],
    ":": ["shift", "semicolon"],
    "\"": ["shift", "quote"],
    "<": ["shift", "comma"],
    ">": ["shift", "period"],
    "?": ["shift", "slash"]
}



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
        if command_str[-1] != "\n":
            command_str = command_str + "\n"
        keycodes = []
        # Only support shift for now
        is_shifted = False
        for c in command_str:
            if c == "\n":
                if is_shifted:
                    is_shifted = False
                    keycodes.append(("KBD_shift", False))
                keycodes.append(("KBD_enter", True))
                keycodes.append(("KBD_enter", False))
            elif c in _KEYS:
                v = _KEYS[c]
                if isinstance(v, str): v = [v]
                for _ in v:
                    keycodes.append(("KBD_%s" % _, True))
                for _ in v[::-1]:
                    keycodes.append(("KBD_%s" % _, False))
            if c in string.ascii_letters + string.digits:
                if c.isupper():
                    if not is_shifted:
                        is_shifted = True
                        keycodes.append(("KBD_shift", True))
                elif c.islower():
                    if is_shifted:
                        is_shifted = False
                        keycodes.append(("KBD_shift", False))
                keycodes.append(("KBD_%s" % c.lower(), True))
                keycodes.append(("KBD_%s" % c.lower(), False))
        self.send({'name': 'sendKeys', 'args': keycodes})
                

    def screenshot(self):
        self.send({'name': 'screenshot', 'args': []})

    def coredump(self, full_memory = True):
        self.send({'name': 'coreDump', 'args': [full_memory]})

    @property
    def last_coredump(self):
        if self._last_coredump is None or len(self._last_coredump) == 0: return None
        return np.frombuffer(self._last_coredump, dtype="u1")
    
    @property
    def last_screenshot(self):
        if self._last_screenshot is None or len(self._last_screenshot) == 0: return None
        return np.frombuffer(self._last_screenshot, dtype="u1").reshape((400,640, 4))