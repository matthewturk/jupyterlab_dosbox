import ipywidgets
import traitlets
from ipywidgets.widgets.trait_types import bytes_serialization

from ._version import __version__
from .utils import DOS_REGISTERS, DOS_SEGMENTS, KEYCODES, make_zipfile

EXTENSION_VERSION = __version__


@ipywidgets.register
class DosCoreDumpModel(ipywidgets.Widget):
    _model_name = traitlets.Unicode("DosboxCoreDumpModel").tag(sync=True)
    _model_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _model_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    _view_name = traitlets.Unicode("DosboxCoreDumpView").tag(sync=True)
    _view_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _view_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)

    memBase = traitlets.CInt().tag(sync=True)
    ip = traitlets.CInt().tag(sync=True)
    flags = traitlets.CInt().tag(sync=True)
    registers = traitlets.Dict().tag(sync=True)
    segments_values = traitlets.Dict().tag(sync=True)
    segments_physical = traitlets.Dict().tag(sync=True)
    numPages = traitlets.CInt().tag(sync=True)
    memoryCopy = traitlets.Bytes(allow_none=True).tag(sync=True, **bytes_serialization)

    def _ipython_display_(self):
        import IPython.display

        try:
            from jupyterlab_kaitai import HexViewer
        except ImportError:
            return
        register_widgets = ipywidgets.VBox(
            [
                ipywidgets.HBox(
                    [
                        ipywidgets.Button(description=reg),
                        ipywidgets.Text(str(self.registers[reg]), disabled=True),
                    ]
                )
                for reg in DOS_REGISTERS
            ]
        )
        segment_widgets = ipywidgets.VBox(
            [
                ipywidgets.HBox(
                    [
                        ipywidgets.Button(description=seg),
                        ipywidgets.Text(str(self.segments_values[seg]), disabled=True),
                    ]
                )
                for seg in DOS_SEGMENTS
            ]
        )
        gb = ipywidgets.HBox([register_widgets, segment_widgets])
        IPython.display.display(
            ipywidgets.VBox([HexViewer(buffer=self.memoryCopy), gb])
        )


@ipywidgets.register
class DosboxScreenshotModel(ipywidgets.DOMWidget):
    _model_name = traitlets.Unicode("DosboxScreenshotModel").tag(sync=True)
    _model_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _model_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    _view_name = traitlets.Unicode("DosboxScreenshotView").tag(sync=True)
    _view_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _view_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)

    screenshot = traitlets.Bytes(allow_none=True).tag(sync=True, **bytes_serialization)
    width = traitlets.CInt().tag(sync=True)
    height = traitlets.CInt().tag(sync=True)


@ipywidgets.register
class DosboxModel(ipywidgets.DOMWidget):
    _model_name = traitlets.Unicode("DosboxRuntimeModel").tag(sync=True)
    _model_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _model_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    _view_name = traitlets.Unicode("DosboxRuntimeView").tag(sync=True)
    _view_module = traitlets.Unicode("jupyterlab-dosbox").tag(sync=True)
    _view_module_version = traitlets.Unicode(EXTENSION_VERSION).tag(sync=True)
    activelayer = traitlets.Unicode("default").tag(sync=True)
    paused = traitlets.Bool(False).tag(sync=True)
    screenshots = traitlets.List(trait=traitlets.Instance(DosboxScreenshotModel)).tag(
        sync=True, **ipywidgets.widget_serialization
    )
    coredumps = traitlets.List(trait=traitlets.Instance(DosCoreDumpModel)).tag(
        sync=True, **ipywidgets.widget_serialization
    )

    def send_characters(self, characters):
        keycodes = []
        for c in characters:
            keycodes.append(("KBD_%s" % c.lower(), True))
            keycodes.append(("KBD_%s" % c.lower(), False))
        command = {"name": "sendKeys", "args": keycodes}
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
        self.send({"name": "sendKeys", "args": keycodes})

    def send_files(self, filenames):
        buffer = make_zipfile(filenames)
        print(f"Sending buffer of length {len(buffer):0.3e} bytes")
        self.send({"name": "sendZipfile", "args": []}, [buffer])

    def send_zip(self, filename):
        buffer = open(filename, "rb").read()
        print(f"Sending buffer of length {len(buffer):0.3e} bytes")
        self.send({"name": "sendZipfile", "args": []}, [buffer])

    def screenshot(self):
        self.send({"name": "screenshot", "args": []})

    def coredump(self):
        self.send({"name": "coreDump", "args": [True]})

    def pop_out(self):
        self.send({"name": "popOut", "args": []})
