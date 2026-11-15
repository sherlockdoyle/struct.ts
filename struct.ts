interface Cursor {
  bytes: Uint8Array;
  view: DataView;
  offset: number;
}
export function cursor(bufferLike: ArrayBuffer | { buffer: ArrayBuffer }, offset = 0): Cursor {
  if (!(bufferLike instanceof ArrayBuffer)) bufferLike = bufferLike.buffer;
  return { bytes: new Uint8Array(bufferLike), view: new DataView(bufferLike), offset };
}

declare const schema: unique symbol;
export type StructBuffer<T> = ArrayBuffer & { [schema]: T };
export abstract class Schema<TIn, TOut = TIn> {
  abstract write(cursor: Cursor, value: TIn): void;
  abstract read(cursor: Cursor): TOut;
  abstract getSize(value: TIn): number;
  abstract skip(cursor: Cursor): void;

  public pack(value: TIn): StructBuffer<TIn> {
    const buffer = new ArrayBuffer(this.getSize(value));
    this.write({ bytes: new Uint8Array(buffer), view: new DataView(buffer), offset: 0 }, value);
    return buffer as StructBuffer<TIn>;
  }
  public unpack(buffer: StructBuffer<TIn>): TOut {
    return this.read({ bytes: new Uint8Array(buffer), view: new DataView(buffer), offset: 0 });
  }
}
export type InferSchemaIn<T extends Schema<any, any>> = T extends Schema<infer TIn, any> ? TIn : never;
export type InferSchemaOut<T extends Schema<any, any>> = T extends Schema<any, infer TOut> ? TOut : never;

abstract class FixedSizedSchema<TIn, TOut = TIn> extends Schema<TIn, TOut> {
  protected abstract readonly size: number;
  protected abstract w(cursor: Readonly<Cursor>, value: TIn): void;
  protected abstract r(cursor: Readonly<Cursor>): TOut;

  override write(cursor: Cursor, value: TIn) {
    this.w(cursor, value);
    cursor.offset += this.size;
  }
  override read(cursor: Cursor): TOut {
    const value = this.r(cursor);
    cursor.offset += this.size;
    return value;
  }
  override getSize() {
    return this.size;
  }
  override skip(cursor: Cursor) {
    cursor.offset += this.size;
  }
}

export class Bool extends FixedSizedSchema<boolean> {
  override readonly size = 1;
  override w(cursor: Readonly<Cursor>, value: boolean) {
    cursor.bytes[cursor.offset] = value ? 1 : 0;
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.bytes[cursor.offset] !== 0;
  }
}

export class U8 extends FixedSizedSchema<number> {
  override readonly size = 1;
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.bytes[cursor.offset] = value;
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.bytes[cursor.offset];
  }
}
export class U16 extends FixedSizedSchema<number> {
  override readonly size = 2;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setUint16(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getUint16(cursor.offset, this.le);
  }
}
export class U32 extends FixedSizedSchema<number> {
  override readonly size = 4;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setUint32(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getUint32(cursor.offset, this.le);
  }
}
export class U64 extends FixedSizedSchema<number | bigint, bigint> {
  override readonly size = 8;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number | bigint) {
    cursor.view.setBigUint64(cursor.offset, BigInt(value), this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getBigUint64(cursor.offset, this.le);
  }
}

export class I8 extends FixedSizedSchema<number> {
  override readonly size = 1;
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setInt8(cursor.offset, value);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getInt8(cursor.offset);
  }
}

export class I16 extends FixedSizedSchema<number> {
  override readonly size = 2;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setInt16(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getInt16(cursor.offset, this.le);
  }
}

export class I32 extends FixedSizedSchema<number> {
  override readonly size = 4;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setInt32(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getInt32(cursor.offset, this.le);
  }
}

export class I64 extends FixedSizedSchema<number | bigint, bigint> {
  override readonly size = 8;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number | bigint) {
    cursor.view.setBigInt64(cursor.offset, BigInt(value), this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getBigInt64(cursor.offset, this.le);
  }
}

export class F16 extends FixedSizedSchema<number> {
  override readonly size = 2;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setFloat16(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getFloat16(cursor.offset, this.le);
  }
}
export class F32 extends FixedSizedSchema<number> {
  override readonly size = 4;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setFloat32(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getFloat32(cursor.offset, this.le);
  }
}
export class F64 extends FixedSizedSchema<number> {
  override readonly size = 8;
  public constructor(private readonly le = true) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: number) {
    cursor.view.setFloat64(cursor.offset, value, this.le);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.view.getFloat64(cursor.offset, this.le);
  }
}

export const bool = new Bool(),
  u8 = new U8(),
  u16 = new U16(),
  u32 = new U32(),
  u64 = new U64(),
  i8 = new I8(),
  i16 = new I16(),
  i32 = new I32(),
  i64 = new I64(),
  f16 = new F16(),
  f32 = new F32(),
  f64 = new F64();

export class Bytes extends FixedSizedSchema<Uint8Array> {
  public constructor(override readonly size: number) {
    super();
  }
  override w(cursor: Readonly<Cursor>, value: Uint8Array) {
    cursor.bytes.set(value, cursor.offset);
  }
  override r(cursor: Readonly<Cursor>) {
    return cursor.bytes.subarray(cursor.offset, cursor.offset + this.size);
  }
}
export const bytes = (size: number) => new Bytes(size);

function strlen(str: string): number {
  let len = 0;
  for (let i = 0; i < str.length; ++i) {
    const c = str.charCodeAt(i);
    if (c < 0x80) len += 1;
    else if (c < 0x800) len += 2;
    else if (
      c >= 0xd800 &&
      c < 0xe000 &&
      i + 1 < str.length &&
      str.charCodeAt(i + 1) >= 0xdc00 &&
      str.charCodeAt(i + 1) <= 0xdfff
    ) {
      len += 4;
      ++i;
    } else len += 3;
  }
  return len;
}

const encoder = new TextEncoder(),
  decoder = new TextDecoder();
export class Str extends Schema<string> {
  override write(cursor: Cursor, value: string) {
    const { written } = encoder.encodeInto(value, cursor.bytes.subarray(cursor.offset + 4));
    cursor.view.setUint32(cursor.offset, written, true);
    cursor.offset += 4 + written;
  }
  override read(cursor: Cursor): string {
    const len = cursor.view.getUint32(cursor.offset, true);
    const value = decoder.decode(cursor.bytes.subarray(cursor.offset + 4, cursor.offset + 4 + len));
    cursor.offset += 4 + len;
    return value;
  }
  override getSize(value: string) {
    return 4 + strlen(value);
  }
  override skip(cursor: Cursor) {
    const len = cursor.view.getUint32(cursor.offset, true);
    cursor.offset += 4 + len;
  }
}
export const str = new Str();

export class CStr extends Schema<string> {
  override write(cursor: Cursor, value: string) {
    const { written } = encoder.encodeInto(value, cursor.bytes.subarray(cursor.offset));
    cursor.bytes[cursor.offset + written] = 0;
    cursor.offset += written + 1;
  }
  override read(cursor: Cursor): string {
    const nullIndex = cursor.bytes.indexOf(0, cursor.offset);
    const value = decoder.decode(cursor.bytes.subarray(cursor.offset, nullIndex));
    cursor.offset = nullIndex + 1;
    return value;
  }
  override getSize(value: string) {
    return strlen(value) + 1;
  }
  override skip(cursor: Cursor) {
    const nullIndex = cursor.bytes.indexOf(0, cursor.offset);
    cursor.offset = nullIndex + 1;
  }
}
export const cstr = new CStr();

export class Buffer extends Schema<Uint8Array> {
  override write(cursor: Cursor, value: Uint8Array) {
    cursor.view.setUint32(cursor.offset, value.length, true);
    cursor.bytes.set(value, cursor.offset + 4);
    cursor.offset += 4 + value.length;
  }
  override read(cursor: Cursor): Uint8Array {
    const len = cursor.view.getUint32(cursor.offset, true);
    const value = cursor.bytes.subarray(cursor.offset + 4, cursor.offset + 4 + len);
    cursor.offset += 4 + len;
    return value;
  }
  override getSize(value: Uint8Array) {
    return 4 + value.length;
  }
  override skip(cursor: Cursor) {
    const len = cursor.view.getUint32(cursor.offset, true);
    cursor.offset += 4 + len;
  }
}
export const buf = new Buffer();

export class Enum<const T> extends FixedSizedSchema<T> {
  override readonly size: 1 | 2 | 4;
  #values: T[];
  #valueIndex = new Map<T, number>();
  public constructor(values: T[]) {
    super();
    this.#values = values.sort();
    for (let i = 0; i < values.length; ++i) this.#valueIndex.set(values[i], i);
    this.size = values.length <= 0xff ? 1 : values.length <= 0xffff ? 2 : 4;
  }
  override w(cursor: Readonly<Cursor>, value: T) {
    if (this.size === 1) cursor.bytes[cursor.offset] = this.#valueIndex.get(value)!;
    else if (this.size === 2) cursor.view.setUint16(cursor.offset, this.#valueIndex.get(value)!, true);
    else cursor.view.setUint32(cursor.offset, this.#valueIndex.get(value)!, true);
  }
  override r(cursor: Readonly<Cursor>) {
    if (this.size === 1) return this.#values[cursor.bytes[cursor.offset]];
    else if (this.size === 2) return this.#values[cursor.view.getUint16(cursor.offset, true)];
    else return this.#values[cursor.view.getUint32(cursor.offset, true)];
  }
}
export const enum_ = <const T>(...values: T[]) => new Enum(values);

export class Array_<TIn, TOut = TIn> extends Schema<TIn[], TOut[]> {
  public constructor(
    private readonly schema: Schema<TIn, TOut>,
    private readonly len?: number,
  ) {
    super();
  }
  override write(cursor: Cursor, value: TIn[]) {
    let len = this.len;
    if (len == null) {
      len = value.length;
      cursor.view.setUint32(cursor.offset, len, true);
      cursor.offset += 4;
    }
    for (let i = 0; i < len; ++i) this.schema.write(cursor, value[i]);
  }
  override read(cursor: Cursor): TOut[] {
    let len = this.len;
    if (len == null) {
      len = cursor.view.getUint32(cursor.offset, true);
      cursor.offset += 4;
    }
    const out = new Array<TOut>(Math.min(len, cursor.bytes.length - cursor.offset));
    for (let i = 0; i < len; ++i) out[i] = this.schema.read(cursor);
    return out;
  }
  override getSize(value: TIn[]) {
    let len = this.len,
      size = 0;
    if (len == null) {
      len = value.length;
      size = 4;
    }
    if (this.schema instanceof FixedSizedSchema) size += len * this.schema.getSize();
    else for (let i = 0; i < len; ++i) size += this.schema.getSize(value[i]);
    return size;
  }
  override skip(cursor: Cursor) {
    let len = this.len;
    if (len == null) {
      len = cursor.view.getUint32(cursor.offset, true);
      cursor.offset += 4;
    }
    if (this.schema instanceof FixedSizedSchema) cursor.offset += len * this.schema.getSize();
    else for (let i = 0; i < len; ++i) this.schema.skip(cursor);
  }
}
export class BoolArray extends Schema<boolean[]> {
  public constructor(private readonly len?: number) {
    super();
  }
  override write(cursor: Cursor, value: boolean[]) {
    let len = this.len;
    if (len == null) {
      len = value.length;
      cursor.view.setUint32(cursor.offset, len, true);
      cursor.offset += 4;
    }
    const byteLen = (len + 7) >> 3;
    cursor.bytes.fill(0, cursor.offset, cursor.offset + byteLen);
    for (let i = 0; i < len; ++i) if (value[i]) cursor.bytes[cursor.offset + (i >> 3)] |= 1 << (i & 7);
    cursor.offset += byteLen;
  }
  override read(cursor: Cursor): boolean[] {
    let len = this.len;
    if (len == null) {
      len = cursor.view.getUint32(cursor.offset, true);
      cursor.offset += 4;
    }
    const out = new Array<boolean>(Math.min(len, (cursor.bytes.length - cursor.offset) * 8));
    for (let i = 0; i < len; ++i) out[i] = (cursor.bytes[cursor.offset + (i >> 3)] & (1 << (i & 7))) !== 0;
    cursor.offset += (len + 7) >> 3;
    return out;
  }
  override getSize(value: boolean[]) {
    if (this.len == null) return 4 + ((value.length + 7) >> 3);
    return (this.len + 7) >> 3;
  }

  override skip(cursor: Cursor) {
    if (this.len == null) {
      const len = cursor.view.getUint32(cursor.offset, true);
      cursor.offset += 4 + ((len + 7) >> 3);
    } else cursor.offset += (this.len + 7) >> 3;
  }
}
export function array(schema: Bool, len?: number): BoolArray;
export function array<TIn, TOut = TIn>(schema: Schema<TIn, TOut>, len?: number): Array_<TIn, TOut>;
export function array(schema: Schema<any, any>, len?: number) {
  return schema instanceof Bool ? new BoolArray(len) : new Array_(schema, len);
}

export class Map_<KIn, VIn, KOut = KIn, VOut = VIn> extends Schema<Map<KIn, VIn>, Map<KOut, VOut>> {
  public constructor(
    private readonly keySchema: Schema<KIn, KOut>,
    private readonly valueSchema: Schema<VIn, VOut>,
  ) {
    super();
  }
  override write(cursor: Cursor, value: Map<KIn, VIn>) {
    cursor.view.setUint32(cursor.offset, value.size, true);
    cursor.offset += 4;
    for (const [k, v] of value) {
      this.keySchema.write(cursor, k);
      this.valueSchema.write(cursor, v);
    }
  }
  override read(cursor: Cursor): Map<KOut, VOut> {
    const len = cursor.view.getUint32(cursor.offset, true);
    cursor.offset += 4;
    const out = new Map<KOut, VOut>();
    for (let i = 0; i < len; ++i) out.set(this.keySchema.read(cursor), this.valueSchema.read(cursor));
    return out;
  }
  override getSize(value: Map<KIn, VIn>) {
    let size = 4;
    for (const [k, v] of value) size += this.keySchema.getSize(k) + this.valueSchema.getSize(v);
    return size;
  }
  override skip(cursor: Cursor) {
    const len = cursor.view.getUint32(cursor.offset, true);
    cursor.offset += 4;
    for (let i = 0; i < len; ++i) {
      this.keySchema.skip(cursor);
      this.valueSchema.skip(cursor);
    }
  }
}
export const map = <KIn, VIn, KOut = KIn, VOut = VIn>(keySchema: Schema<KIn, KOut>, valueSchema: Schema<VIn, VOut>) =>
  new Map_<KIn, VIn, KOut, VOut>(keySchema, valueSchema);

export class Pad extends FixedSizedSchema<void> {
  public constructor(override readonly size: number) {
    super();
  }
  override w() {}
  override r() {}
}
export const pad = (size: number) => new Pad(size);

type NamedField = readonly [name: string, type: Schema<any, any>];
type StructFields = ReadonlyArray<NamedField | readonly [null, Pad]>;
// prettier-ignore
type InferStructIn<T extends StructFields> = {
  [K in T[number] as K[0] extends string ? (K[1] extends Pad ? never : K[0]) : never]:
  K[1] extends Schema<infer In, any> ? In : never;
};
// prettier-ignore
type InferStructOut<T extends StructFields> = {
  [K in T[number] as K[0] extends string ? (K[1] extends Pad ? never : K[0]) : never]: 
    K[1] extends Schema<any, infer Out> ? Out : never;
};
export class Struct<const T extends StructFields> extends Schema<InferStructIn<T>, InferStructOut<T>> {
  public constructor(protected readonly schema: T) {
    super();
  }
  override write(cursor: Cursor, value: InferStructIn<T>) {
    for (let i = 0; i < this.schema.length; ++i) {
      const schema = this.schema[i];
      if (schema[0] == null) schema[1].write(cursor);
      else schema[1].write(cursor, value[schema[0] as keyof InferStructIn<T>]);
    }
  }
  override read(cursor: Cursor): InferStructOut<T> {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < this.schema.length; ++i) {
      const schema = this.schema[i];
      if (schema[0] == null) schema[1].read(cursor);
      else out[schema[0]] = schema[1].read(cursor);
    }
    return out as InferStructOut<T>;
  }
  override getSize(value: InferStructIn<T>) {
    let size = 0;
    for (let i = 0; i < this.schema.length; ++i)
      size += this.schema[i][1].getSize(value[this.schema[i][0] as keyof InferStructIn<T>]);
    return size;
  }
  override skip(cursor: Cursor) {
    for (let i = 0; i < this.schema.length; ++i) this.schema[i][1].skip(cursor);
  }
}

type ExtractNamed<T extends StructFields> = Extract<T[number], NamedField>;
type ExtractFixed<T extends StructFields> = Extract<ExtractNamed<T>, readonly [string, FixedSizedSchema<any, any>]>;
type ExtractVar<T extends StructFields> = Exclude<ExtractNamed<T>, ExtractFixed<T>>;
type InferPartialStructIn<T extends StructFields> = {
  [K in ExtractFixed<T>[0]]?: Extract<ExtractFixed<T>, readonly [K, any]>[1] extends Schema<infer In, any> ? In : never;
} & {
  [K in ExtractVar<T>[0]]: Extract<ExtractVar<T>, readonly [K, any]>[1] extends Schema<infer In, any> ? In : never;
};
type InferPartialStructSet<T extends StructFields> = {
  [K in ExtractFixed<T>[0]]?: Extract<ExtractFixed<T>, readonly [K, any]>[1] extends Schema<infer In, any> ? In : never;
};
export class PartialStruct<const T extends StructFields> extends Struct<T> {
  override write(cursor: Cursor, value: InferPartialStructIn<T>) {
    for (let i = 0; i < this.schema.length; ++i) {
      const schema = this.schema[i];
      if (schema[0] == null) schema[1].write(cursor);
      else {
        const val = value[schema[0] as keyof InferPartialStructIn<T>];
        if (val == null) cursor.offset += (schema[1] as FixedSizedSchema<any, any>).getSize();
        else schema[1].write(cursor, val);
      }
    }
  }
  public set(cursor: Cursor | StructBuffer<InferStructIn<T>>, value: InferPartialStructSet<T>) {
    cursor =
      cursor instanceof ArrayBuffer
        ? { bytes: new Uint8Array(cursor), view: new DataView(cursor), offset: 0 }
        : { ...cursor }; // copy so we don't modify the original cursor

    for (let i = 0; i < this.schema.length; ++i) {
      const schema = this.schema[i];
      if (schema[0] != null && value[schema[0] as keyof InferPartialStructSet<T>] != null)
        schema[1].write(cursor, value[schema[0] as keyof InferPartialStructSet<T>]);
      else schema[1].skip(cursor);
    }
  }
}

const primitives = { bool, u8, u16, u32, u64, i8, i16, i32, i64, f16, f32, f64, str, cstr, buf };
type CompactDefinition =
  | keyof typeof primitives
  | Schema<any, any>
  | readonly CompactDefinition[]
  | { readonly [key: string]: CompactDefinition };
type OrderedStructDef = ReadonlyArray<readonly [name: string, type: CompactDefinition] | readonly [null, Pad]>;
type UnorderedStructDef = Record<string, CompactDefinition>;
type ResolveSchema<T> =
  T extends Schema<any, any>
    ? T
    : T extends keyof typeof primitives
      ? (typeof primitives)[T]
      : T extends any[]
        ? Tuple<{ [K in keyof T]: ResolveSchema<T[K]> }>
        : T extends Record<string, any>
          ? Struct<MappedUnorderedFields<T>>
          : never;
type MappedOrderedFields<T extends OrderedStructDef> = {
  [K in keyof T]: T[K] extends readonly [infer Name, infer Type]
    ? Name extends null
      ? [null, Pad]
      : [Name & string, ResolveSchema<Type>]
    : never;
};
type MappedUnorderedFields<T extends UnorderedStructDef> = ReadonlyArray<
  { [K in keyof T]: [K & string, ResolveSchema<T[K]>] }[keyof T]
>;
export function struct<const T extends OrderedStructDef>(def: T, partial?: false): Struct<MappedOrderedFields<T>>;
export function struct<const T extends UnorderedStructDef>(def: T, partial?: false): Struct<MappedUnorderedFields<T>>;
export function struct<const T extends OrderedStructDef>(def: T, partial: true): PartialStruct<MappedOrderedFields<T>>;
export function struct<const T extends UnorderedStructDef>(
  def: T,
  partial: true,
): PartialStruct<MappedUnorderedFields<T>>;
export function struct(def: OrderedStructDef | UnorderedStructDef, partial = false) {
  const StructClass = partial ? PartialStruct : Struct;

  if (Array.isArray(def))
    return new StructClass<MappedOrderedFields<OrderedStructDef>>(def.map(([name, type]) => [name, resolve(type)]));

  return new StructClass<MappedUnorderedFields<UnorderedStructDef>>(
    Object.entries(def)
      .sort(([na], [nb]) => na.localeCompare(nb))
      .map(([name, type]) => [name, resolve(type)]),
  );
}
function resolve<const T extends CompactDefinition>(def: T): ResolveSchema<T> {
  if (def instanceof Schema) return def as ResolveSchema<T>;
  if (typeof def === 'string') return primitives[def as keyof typeof primitives] as ResolveSchema<T>;
  if (Array.isArray(def)) return new Tuple(def.map(resolve)) as ResolveSchema<T>;
  return struct(def as UnorderedStructDef) as ResolveSchema<T>;
}

// prettier-ignore
type BitLengths =
  |  1 |  2 |  3 |  4 |  5 |  6 |  7 |  8 |  9 |  10 |  11 |  12 |  13 |  14 |  15 |  16 |  17 |  18 |  19 |  20 |  21 |  22 |  23 |  24 |  25 |  26 |  27 |  28 |  29 |  30 |  31 |  32
  | -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9 | -10 | -11 | -12 | -13 | -14 | -15 | -16 | -17 | -18 | -19 | -20 | -21 | -22 | -23 | -24 | -25 | -26 | -27 | -28 | -29 | -30 | -31 | -32;
type BitfieldFields = ReadonlyArray<readonly [name: string, bits: BitLengths | Bool] | readonly [null, bits: number]>;
type InferBitfield<T extends BitfieldFields> = {
  [K in T[number] as K[0] extends string ? K[0] : never]: K[1] extends Bool ? boolean : number;
};
export class Bitfield<const T extends BitfieldFields> extends FixedSizedSchema<InferBitfield<T>> {
  override readonly size: number;
  readonly #schema: { name: string; size: number; offset: number; isBool: boolean; signed: boolean }[] = [];
  public constructor(def: T) {
    super();
    let offset = 0;
    for (let i = 0; i < def.length; ++i) {
      const [name, type] = def[i];
      const isBool = type instanceof Bool;
      const size = isBool ? 1 : Math.abs(type);
      if (name != null) this.#schema.push({ name, size, offset, isBool, signed: !isBool && type < 0 });
      offset += size;
    }
    this.size = (offset + 7) >> 3;
  }
  override w(cursor: Readonly<Cursor>, value: InferBitfield<T>) {
    cursor.bytes.fill(0, cursor.offset, cursor.offset + this.size);
    for (let i = 0; i < this.#schema.length; ++i) {
      let { size, offset } = this.#schema[i];
      const v = value[this.#schema[i].name as keyof InferBitfield<T>];
      let val = this.#schema[i].isBool ? (v ? 1 : 0) : (v as number) & (0xffffffff >>> (32 - size));

      while (size > 0) {
        const byteIndex = cursor.offset + (offset >> 3),
          bitPos = offset & 7;
        const bitsToWrite = Math.min(8 - bitPos, size);
        cursor.bytes[byteIndex] |= (val & ((1 << bitsToWrite) - 1)) << bitPos;

        val >>>= bitsToWrite;
        size -= bitsToWrite;
        offset += bitsToWrite;
      }
    }
  }
  override r(cursor: Readonly<Cursor>): InferBitfield<T> {
    const out: Record<string, unknown> = {};

    for (let i = 0; i < this.#schema.length; ++i) {
      let { name, size, offset } = this.#schema[i],
        shift = 0;
      let val = 0;
      while (size > 0) {
        const byteIndex = cursor.offset + (offset >> 3),
          bitPos = offset & 7;
        const bitsToRead = Math.min(8 - bitPos, size);
        val |= ((cursor.bytes[byteIndex] >>> bitPos) & ((1 << bitsToRead) - 1)) << shift;

        shift += bitsToRead;
        size -= bitsToRead;
        offset += bitsToRead;
      }

      if (this.#schema[i].isBool) out[name] = val !== 0;
      else if (this.#schema[i].signed) {
        const signShift = 32 - this.#schema[i].size;
        out[name] = (val << signShift) >> signShift;
      } else out[name] = val >>> 0;
    }

    return out as InferBitfield<T>;
  }
}
export const bitfield = <const T extends BitfieldFields>(def: T) => new Bitfield(def);
export const bitset = <const T extends readonly string[]>(...names: T) =>
  new Bitfield<{ [K in keyof T]: readonly [T[K], Bool] }>(names.map(n => [n, bool]) as any);

type ConcatFields = ReadonlyArray<Schema<Record<string, any>, Record<string, any>>>;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type InferConcatIn<T extends ConcatFields> = UnionToIntersection<T[number] extends Schema<infer In, any> ? In : never>;
type InferConcatOut<T extends ConcatFields> = UnionToIntersection<
  T[number] extends Schema<any, infer Out> ? Out : never
>;
export class Concat<const T extends ConcatFields> extends Schema<InferConcatIn<T>, InferConcatOut<T>> {
  public constructor(private readonly schema: T) {
    super();
  }
  override write(cursor: Cursor, value: InferConcatIn<T>) {
    for (let i = 0; i < this.schema.length; ++i) this.schema[i].write(cursor, value as Record<string, any>);
  }
  override read(cursor: Cursor): InferConcatOut<T> {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < this.schema.length; ++i) Object.assign(out, this.schema[i].read(cursor));
    return out as InferConcatOut<T>;
  }
  override getSize(value: InferConcatIn<T>) {
    let size = 0;
    for (let i = 0; i < this.schema.length; ++i) size += this.schema[i].getSize(value as Record<string, any>);
    return size;
  }
  override skip(cursor: Cursor) {
    for (let i = 0; i < this.schema.length; ++i) this.schema[i].skip(cursor);
  }
}
export const concat = <const T extends ConcatFields>(...schemas: T) => new Concat(schemas);

type UnionFields = Record<string, FixedSizedSchema<any, any>>;
type InferUnionIn<T extends UnionFields> = {
  [K in keyof T]: { [K2 in K]: T[K] extends FixedSizedSchema<infer In, any> ? In : never } & {
    [K2 in Exclude<keyof T, K>]?: never;
  };
}[keyof T];
type InferUnionOut<T extends UnionFields> = {
  [K in keyof T]: T[K] extends FixedSizedSchema<any, infer Out> ? Out : never;
};
export class Union<const T extends UnionFields> extends FixedSizedSchema<InferUnionIn<T>, InferUnionOut<T>> {
  override readonly size: number;
  public constructor(private readonly schema: T) {
    super();
    this.size = Object.values(this.schema).reduce((a, b) => Math.max(a, b.getSize()), 0);
  }
  override w(cursor: Cursor, value: InferUnionIn<T>) {
    const { offset } = cursor;
    const type = Object.keys(value)[0] as keyof T;
    this.schema[type].write(cursor, value[type]);
    cursor.offset = offset;
  }
  override r(cursor: Cursor): InferUnionOut<T> {
    const out: Record<string, unknown> = {};
    const { offset } = cursor;
    for (const key in this.schema) {
      out[key] = this.schema[key].read(cursor);
      cursor.offset = offset;
    }
    return out as InferUnionOut<T>;
  }
}
export const union = <T extends UnionFields>(schema: T) => new Union<T>(schema);

type TaggedUnionFields = Record<string, Schema<any, any>>;
type InferTaggedUnionIn<T extends TaggedUnionFields> = {
  [K in keyof T]: { type: K; value: T[K] extends Schema<infer In, any> ? In : never };
}[keyof T];
type InferTaggedUnionOut<T extends TaggedUnionFields> = {
  [K in keyof T]: { type: K; value: T[K] extends Schema<any, infer Out> ? Out : never };
}[keyof T];
export class TaggedUnion<const T extends TaggedUnionFields> extends Schema<
  InferTaggedUnionIn<T>,
  InferTaggedUnionOut<T>
> {
  readonly #types: Enum<keyof T>;
  public constructor(private readonly schema: T) {
    super();
    this.#types = new Enum<keyof T>(Object.keys(this.schema).sort());
  }
  override write(cursor: Cursor, value: InferTaggedUnionIn<T>) {
    this.#types.write(cursor, value.type);
    this.schema[value.type].write(cursor, value.value);
  }
  override read(cursor: Cursor): InferTaggedUnionOut<T> {
    const type = this.#types.read(cursor);
    return { type, value: this.schema[type].read(cursor) };
  }
  override getSize(value: InferTaggedUnionIn<T>) {
    return this.#types.getSize() + this.schema[value.type].getSize(value.value);
  }
  override skip(cursor: Cursor) {
    const type = this.#types.read(cursor);
    this.schema[type].skip(cursor);
  }
}
export const taggedUnion = <T extends TaggedUnionFields>(schema: T) => new TaggedUnion<T>(schema);

type TupleFields = ReadonlyArray<Schema<any, any>>;
type InferTupleIn<T extends TupleFields> = { [K in keyof T]: T[K] extends Schema<infer In, any> ? In : never };
type InferTupleOut<T extends TupleFields> = { [K in keyof T]: T[K] extends Schema<any, infer Out> ? Out : never };
export class Tuple<const T extends TupleFields> extends Schema<InferTupleIn<T>, InferTupleOut<T>> {
  public constructor(private readonly schema: T) {
    super();
  }
  override write(cursor: Cursor, value: InferTupleIn<T>) {
    for (let i = 0; i < this.schema.length; ++i) this.schema[i].write(cursor, value[i]);
  }
  override read(cursor: Cursor): InferTupleOut<T> {
    const out = new Array<unknown>(this.schema.length);
    for (let i = 0; i < this.schema.length; ++i) out[i] = this.schema[i].read(cursor);
    return out as InferTupleOut<T>;
  }
  override getSize(value: InferTupleIn<T>) {
    let size = 0;
    for (let i = 0; i < this.schema.length; ++i) size += this.schema[i].getSize(value[i]);
    return size;
  }
  override skip(cursor: Cursor) {
    for (let i = 0; i < this.schema.length; ++i) this.schema[i].skip(cursor);
  }
}
export const tuple = <T extends TupleFields>(...schema: T) => new Tuple<T>(schema);

export class Optional<TIn, TOut = TIn> extends Schema<TIn | null, TOut | null> {
  public constructor(private readonly schema: Schema<TIn, TOut>) {
    super();
  }
  override write(cursor: Cursor, value: TIn | null) {
    cursor.bytes[cursor.offset++] = value == null ? 0 : 1;
    if (value != null) this.schema.write(cursor, value);
  }
  override read(cursor: Cursor): TOut | null {
    const isPresent = cursor.bytes[cursor.offset++] !== 0;
    return isPresent ? this.schema.read(cursor) : null;
  }
  override getSize(value: TIn | null) {
    if (value == null) return 1;
    return 1 + this.schema.getSize(value);
  }
  override skip(cursor: Cursor) {
    const isPresent = cursor.bytes[cursor.offset++] !== 0;
    if (isPresent) this.schema.skip(cursor);
  }
}
export const optional = <TIn, TOut = TIn>(schema: Schema<TIn, TOut>) => new Optional<TIn, TOut>(schema);

class CustomSchema<TIn, TOut = TIn> extends FixedSizedSchema<TIn, TOut> {
  public constructor(
    readonly size: number,
    readonly w: (cursor: Readonly<Cursor>, value: TIn) => void,
    readonly r: (cursor: Readonly<Cursor>) => TOut,
  ) {
    super();
  }
}
export const custom = <TIn, TOut = TIn>(
  size: number,
  writeFn: (cursor: Readonly<Cursor>, value: TIn) => void,
  readFn: (cursor: Readonly<Cursor>) => TOut,
) => new CustomSchema<TIn, TOut>(size, writeFn, readFn);

export const datetime = new CustomSchema<Date>(
  8,
  (cursor, value) => cursor.view.setFloat64(cursor.offset, value.getTime(), true),
  cursor => new Date(cursor.view.getFloat64(cursor.offset, true)),
);

const h2b = new Uint8Array(256),
  b2h: string[] = [];
for (let i = 0; i < 256; ++i) b2h[i] = (i + 0x100).toString(16).substring(1);
for (let i = 48; i < 58; ++i) h2b[i] = i - 48; // '0' - '9'
for (let i = 65; i < 71; ++i) h2b[i] = i - 55; // 'A' - 'F'
for (let i = 97; i < 103; ++i) h2b[i] = i - 87; // 'a' - 'f'
export const uuid = new CustomSchema<string>(
  16,
  (c, v) => {
    for (let i = 0, wi = c.offset; i < 36; ++i)
      if (v.charCodeAt(i) !== 45) c.bytes[wi++] = (h2b[v.charCodeAt(i)] << 4) | h2b[v.charCodeAt(++i)];
  },
  c =>
    b2h[c.bytes[c.offset]] +
    b2h[c.bytes[c.offset + 1]] +
    b2h[c.bytes[c.offset + 2]] +
    b2h[c.bytes[c.offset + 3]] +
    '-' +
    b2h[c.bytes[c.offset + 4]] +
    b2h[c.bytes[c.offset + 5]] +
    '-' +
    b2h[c.bytes[c.offset + 6]] +
    b2h[c.bytes[c.offset + 7]] +
    '-' +
    b2h[c.bytes[c.offset + 8]] +
    b2h[c.bytes[c.offset + 9]] +
    '-' +
    b2h[c.bytes[c.offset + 10]] +
    b2h[c.bytes[c.offset + 11]] +
    b2h[c.bytes[c.offset + 12]] +
    b2h[c.bytes[c.offset + 13]] +
    b2h[c.bytes[c.offset + 14]] +
    b2h[c.bytes[c.offset + 15]],
);

export class LazySchema<TIn, TOut = TIn> extends Schema<TIn, TOut> {
  public constructor(private readonly schemaFn: () => Schema<TIn, TOut>) {
    super();
  }
  #schemaCache?: Schema<TIn, TOut>;
  get #schema(): Schema<TIn, TOut> {
    if (!this.#schemaCache) this.#schemaCache = this.schemaFn();
    return this.#schemaCache;
  }
  override write(cursor: Cursor, value: TIn) {
    this.#schema.write(cursor, value);
  }
  override read(cursor: Cursor): TOut {
    return this.#schema.read(cursor);
  }
  override getSize(value: TIn): number {
    return this.#schema.getSize(value);
  }
  override skip(cursor: Cursor) {
    this.#schema.skip(cursor);
  }
}
export const lazy = <TIn, TOut = TIn>(schemaFn: () => Schema<TIn, TOut>) => new LazySchema<TIn, TOut>(schemaFn);
