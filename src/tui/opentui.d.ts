declare module '@opentui/core' {
  import { EventEmitter } from 'events';

  export interface RenderContext {
    root: RootRenderable;
    keyInput: KeyHandler;
    width: number;
    height: number;
  }

  export interface RenderableOptions {
    id?: string;
    width?: number | 'auto' | `${number}%`;
    height?: number | 'auto' | `${number}%`;
    flexGrow?: number;
    flexShrink?: number;
    flexDirection?: 'row' | 'column';
    padding?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
  }

  export class Renderable extends EventEmitter {
    id: string;
    parent: Renderable | null;
    add(obj: Renderable, index?: number): number;
    remove(id: string): void;
    getChildren(): Renderable[];
    focus(): void;
    destroy(): void;
  }

  export class RootRenderable extends Renderable {}

  export interface BoxOptions extends RenderableOptions {
    backgroundColor?: string;
    border?: boolean;
    borderStyle?: 'single' | 'double' | 'round';
    borderColor?: string;
  }

  export class BoxRenderable extends Renderable {
    constructor(ctx: RenderContext, options: BoxOptions);
  }

  export interface TextOptions extends RenderableOptions {
    content?: string;
    fg?: string;
    bg?: string;
  }

  export class TextRenderable extends Renderable {
    constructor(ctx: RenderContext, options: TextOptions);
    content: string;
  }

  export interface SelectOption {
    name: string;
    description: string;
    value?: unknown;
  }

  export interface SelectRenderableOptions extends RenderableOptions {
    options?: SelectOption[];
    selectedIndex?: number;
    backgroundColor?: string;
    textColor?: string;
    focusedBackgroundColor?: string;
    focusedTextColor?: string;
    selectedBackgroundColor?: string;
    selectedTextColor?: string;
    descriptionColor?: string;
    showDescription?: boolean;
  }

  export enum SelectRenderableEvents {
    SELECTION_CHANGED = 'selectionChanged',
    ITEM_SELECTED = 'itemSelected',
  }

  export class SelectRenderable extends Renderable {
    constructor(ctx: RenderContext, options: SelectRenderableOptions);
    getSelectedOption(): SelectOption | null;
    getSelectedIndex(): number;
    setSelectedIndex(index: number): void;
  }

  export interface KeyEvent {
    name: string;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    sequence: string;
  }

  export class KeyHandler extends EventEmitter {
    on(event: 'keypress', listener: (key: KeyEvent) => void): this;
  }

  export interface CliRendererConfig {
    exitOnCtrlC?: boolean;
    useAlternateScreen?: boolean;
    useMouse?: boolean;
  }

  export class CliRenderer extends EventEmitter implements RenderContext {
    root: RootRenderable;
    keyInput: KeyHandler;
    width: number;
    height: number;
    start(): void;
    stop(): void;
    suspend(): void;
    resume(): void;
    destroy(): void;
  }

  export function createCliRenderer(config?: CliRendererConfig): Promise<CliRenderer>;
}
