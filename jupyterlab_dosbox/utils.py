import os
import string
import zipfile
import io
import functools
import asyncio

KEYCODES = {
    "\t": [False, "tab"],
    " ": [False, "space"],
    #public KBD_grave = 96;
    "-": [False, "minus"],
    "=": [False, "equals"],
    "\\": [False, "backslash"],
    "[": [False, "leftbracket"],
    "]": [False, "rightbracket"],
    ";": [False, "semicolon"],
    "'": [False, "quote"],
    "." : [False, "period"],
    "," : [False, "comma"],
    "/" : [False, "slash"],
    "!" : [True, "1"],
    "@":  [True, "2"],
    "#": [True, "3"],
    "$": [True, "4"],
    "%": [True, "5"],
    "^": [True, "6"],
    "&": [True, "7"],
    "*": [True, "8"],
    "(": [True, "9"],
    ")": [True, "0"],
    "_": [True, "minus"],
    "+": [True, "equals"],
    "{": [True, "leftbracket"],
    "}": [True, "rightbracket"],
    "|": [True, "backslash"],
    ":": [True, "semicolon"],
    "\"": [True, "quote"],
    "<": [True, "comma"],
    ">": [True, "period"],
    "?": [True, "slash"]
}

KEYCODES.update(
    [_, (True, _.lower())] for _ in string.ascii_uppercase
)
KEYCODES.update(
    [_, (False, _)] for _ in string.ascii_lowercase
)

def make_zipfile(filenames, prefix_directory = ""):
    """
    This accepts either a list of strings, in which case the files will be
    added to an in-memory zipfile from those named files, or a set of
    dictionary entries, where the dictionary keys are the filenames and the
    values are the contents of those files.
    """
    # First we need to figure out the full set of directories, because
    # for our purposes we need to make sure that all of the directories
    # have been created.
    if isinstance(filenames, list):
        filenames = {_: None for _ in filenames}
    dirnames = set()
    for fn in filenames:
        dirnames.add(os.path.dirname(fn))
    base = os.path.commonpath(list(dirnames))
    # This breaks if everything is under a subdirectory
    #dirnames = set(os.path.relpath(_, base) for _ in dirnames if len(_) > 0)
    if '.' in dirnames: dirnames.remove('.')
    if '' in dirnames: dirnames.remove('')
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as f:
        for d in sorted(dirnames):
            f.writestr(os.path.join(d, ""), "")
        for fn, content in filenames.items():
            if content is None:
                f.write(fn, arcname=os.path.join(prefix_directory, fn))
            else:
                f.writestr(fn, content)
    b.seek(0)
    return b.read()

def recompress_zipfile(input_filename, prefix_directory = ""):
    """
    This accepts an input filename of a zip file that needs to be converted
    to something that is just ZIP_STORED, and it returns the bytes of the new
    version.  It does keep it all in memory, though!
    """
    output_bytes = {}
    with zipfile.ZipFile(input_filename, "r") as f:
        for fn in f.namelist():
            output_bytes[fn] = f.read(fn)
    return make_zipfile(output_bytes, prefix_directory)

# Inspired by https://ipywidgets.readthedocs.io/en/latest/examples/Widget%20Asynchronous.html
def wait_for_change(widget, value):
    future = asyncio.Future()
    def getvalue(change):
        # make the new value available
        future.set_result(change.new)
        widget.unobserve(getvalue, value)
    widget.observe(getvalue, value)
    return future

def test_zipfile():
    zf = make_zipfile(
        {'hi/there.txt': 'this is text',
         'hello.txt': 'more_text!',
         'README.md': None}
    )
    o = io.BytesIO(zf)
    o.seek(0)
    with zipfile.ZipFile(o, "r") as f:
        assert(f.getinfo("hi/").is_dir() == True)
        assert(f.getinfo("hi/there.txt").is_dir() == False)
        assert(f.getinfo("hello.txt").is_dir() == False)
        assert(f.getinfo("README.md").is_dir() == False)

def test_bundlefile():
    from jupyterlab_dosbox.handlers import _default_components
    import pkg_resources
    filenames = {}
    for fn in _default_components:
        data = pkg_resources.resource_stream("jupyterlab_dosbox",
                os.path.join("bundles", fn)).read()
        filenames[os.path.join(".jsdos", fn)] = data
    with open("output.zip", "wb") as f:
        f.write(make_zipfile(filenames))

if __name__ == "__main__":
    test_zipfile()
    test_bundlefile()