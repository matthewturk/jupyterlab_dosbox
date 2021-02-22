import { Signal, ISignal } from '@lumino/signaling';
import { ModelDB } from '@jupyterlab/observables';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';

type EmscriptenFileModel = {
  name: string;
  path: string;
  type: Contents.ContentType;
  writable: boolean;
  created: string;
  last_modified: string;
  mimetype: string;
  content: any;
  chunk?: number;
  format: Contents.FileFormat;
  size?: number;
  indices?: readonly number[];
};

// eslint-disable-next-line @typescript-eslint/naming-convention
interface ErrnoError extends Error {
  node?: FS.FSNode;
  errno: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface EMFSStat {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  blksize: number;
  blocks: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface EMFSNode {
  name: string;
}

export class EmscriptenDrive implements Contents.IDrive {
  constructor(fs: typeof FS) {
    this.fs = fs;
  }

  serverSettings: ServerConnection.ISettings;
  modelDBFactory?: ModelDB.IFactory;

  get(
    localPath: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    //console.log(`Requesting "${localPath}"`);
    const model = this.pathToContentsModel('', localPath);
    if (model.type === 'directory') {
      // Fill with the contents
      model.content = this.fs.readdir('/' + localPath) as Array<string>;
      model.content = model.content
        .map((element: string) => this.pathToContentsModel(localPath, element))
        .filter((element: any) => element !== undefined);
    } else if (model.type === 'file') {
      const v = this.fs.readFile('/' + localPath, { encoding: 'utf8' });
      model.content = v;
      model.format = 'text';
    }
    return Promise.resolve(model);
  }
  getDownloadUrl(localPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  newUntitled(options?: Contents.ICreateOptions): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }
  delete(localPath: string): Promise<void> {
    this.fs.unlink(localPath);
    return new Promise<void>(() => null);
  }
  rename(oldLocalPath: string, newLocalPath: string): Promise<Contents.IModel> {
    this.fs.rename(oldLocalPath, newLocalPath);
    return new Promise<Contents.IModel>(() =>
      this.pathToContentsModel('', newLocalPath)
    );
  }
  save(
    localPath: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }
  copy(localPath: string, toLocalDir: string): Promise<Contents.IModel> {
    throw new Error('Method not implemented.');
  }
  createCheckpoint(localPath: string): Promise<Contents.ICheckpointModel> {
    throw new Error('Method not implemented.');
  }
  listCheckpoints(localPath: string): Promise<Contents.ICheckpointModel[]> {
    throw new Error('Method not implemented.');
  }
  restoreCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deleteCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  isDisposed: boolean;
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    Signal.clearData(this);
  }

  fs: typeof FS;

  get name(): 'EmscriptenFS' {
    return 'EmscriptenFS';
  }

  get fileChanged(): ISignal<this, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);

  pathToContentsModel(localPath: string, fn: string): EmscriptenFileModel {
    if (fn === '.') {
      return null;
    }
    let node: EMFSNode;
    let stat: EMFSStat;
    let name: string;
    const path = PathExt.join(localPath, fn);
    //console.log(`Trying "${path}"`);
    try {
      node = this.fs.lookupPath('/' + path, {}).node as EMFSNode;
      stat = this.fs.stat('/' + path);
    } catch (e) {
      console.log(e);
      return;
    }
    //console.log(node, stat);
    if (fn === '.' || fn === '..') {
      name = fn;
    } else {
      name = node.name;
    }
    const newModel: EmscriptenFileModel = {
      name: name,
      path: path,
      type: this.fs.isDir(stat.mode) ? 'directory' : 'file',
      writable: true, // always true
      created: stat.ctime.toISOString(),
      last_modified: stat.mtime.toISOString(),
      mimetype: 'text/text-plain',
      content: undefined,
      format: 'text',
      size: stat.size
    };
    return newModel;
  }
}
