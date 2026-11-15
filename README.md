# struct.ts

Typed, schema-driven binary serialization for TypeScript. Schemas describe a binary layout and provide typed `pack` and `unpack` operations.

## Install

```sh
npm install @sherlockdoyle/struct.ts
```

## Quick start

See [`struct.test.ts`](./struct.test.ts) for more examples.

```ts
import { bool, u32, str, struct } from '@sherlockdoyle/struct.ts';

// Use schema names for a concise definition:
const packetByName = struct({
  id: 'u32',
  active: 'bool',
  name: 'str',
});

// Or pass schema instances for autocomplete, reuse, and composition:
const packet = struct({
  id: u32,
  active: bool,
  name: str,
});

const input = { id: 42, active: true, name: 'Ada' };
const bytes = packet.pack(input);
const output = packet.unpack(bytes); // { id: 42, active: true, name: 'Ada' }
```

**Byte layout:** (alphabetical) `[active:1][id:u32 LE][name.length:u32 LE][name UTF-8]`; for this input: `[01][2a 00 00 00][03 00 00 00][41 64 61]`.

Each field in an object definition can use either a schema instance (such as `u32`) or a built-in schema name (such as `'u32'`). The resulting input and output types are inferred from the definition.

## Defining structs

Object definitions are convenient for named fields and are serialized in alphabetical field-name order. Use an ordered definition when the byte order must follow a specific protocol layout:

```ts
import { u8, u16, U16, str, pad, struct } from '@sherlockdoyle/struct.ts';

const alphabeticalHeader = struct({
  name: 'str', // you can use schema name
  kind: u8, // schema instance
  // padding is not supported in this form
  length: new U16(), // or even a new instance
});
// serialized in alphabetical order: [kind][length][name]
// if you want exact order, use ordered definition like below

const header = struct([
  ['name', str],
  ['kind', u8],
  [null, pad(2)], // two reserved bytes
  ['length', u16],
]);
```

The object-form layout is `[kind:u8][length:u16 LE][name.length:u32 LE][name UTF-8]`.  
The ordered layout is `[name.length:u32 LE][name UTF-8][kind:u8][reserved:2 bytes][length:u16 LE]`.

In an object definition, nested objects create nested structs. A schema list inside `struct` is a fixed-length tuple (not an array). Use `array(schema)` for a length-prefixed array, or `array(schema, len)` to store a fixed number of items without the 4-byte count prefix:

```ts
import { u8, i16, f32, array, struct } from '@sherlockdoyle/struct.ts';

const message = struct({
  header: { kind: u8, version: u8 },
  position: [f32, f32], // fixed tuple: [number, number]
  samples: array(i16), // variable-length number[]
  gains: array(f32, 4), // fixed-length float array: 4 values, no count prefix
});

const input = {
  header: { kind: 2, version: 1 },
  position: [12.5, -4],
  samples: [10, 20, 30],
  gains: [1.0, 0.5, 0.25, 0.125],
};
const decoded = message.unpack(message.pack(input));
```

**Byte layout:** Stored in alphabetical field order:  
`[gains:f32 LE × 4][header.kind:u8 + version.u8][position:f32 LE × 2][samples.length:u32 LE + each i16 LE]`.  
`gains` has no count prefix; the variable-length `samples` array does.

The equivalent tuple can also be constructed explicitly with `tuple(f32, f32)`. For variable-length arrays, use `array(f32)`; for fixed-width arrays without a count prefix, pass a length such as `array(f32, 4)`. When the element is specified as a built-in name, `array` still takes a schema instance, for example `array(u8)` (not `array('u8')`). Boolean arrays are bit-packed and use the same API: `array(bool)` stores a `boolean[]` with a compact bitmask layout (`BoolArray`), and `array(bool, n)` stores exactly `n` boolean flags without a length prefix.

## Binary and type behavior

- Fixed-width integers and floats use little-endian byte order by default. `U16`, `U32`, `U64`, `I16`, `I32`, `I64`, `F16`, `F32`, and `F64` constructors accept `false` for big-endian. One-byte values have no byte order.
- `u64` and `i64` accept a `number` or `bigint` and always unpack as `bigint`. Use `bigint` to preserve the full 64-bit range.
- Dynamic strings, buffers, arrays, and maps have a 4-byte little-endian length prefix. `str` uses UTF-8. `cstr` uses a zero-byte terminator and therefore cannot represent an embedded zero byte.
- `bytes(n)` is a fixed-width byte sequence, unlike length-prefixed `buf`. Unpacking `bytes(n)` or `buf` returns a view into the packed buffer.
- `enum_(...)` stores the value's index in its sorted list: 1 byte for up to 255 values, 2 bytes for up to 65,535, otherwise 4 bytes.
- `bitfield` packs fields least-significant-bit first. Use a positive bit width for unsigned integers, a negative width for signed integers, `bool` for one bit, or `[null, width]` for unnamed reserved bits.
- `union` overlays fixed-width schemas; `taggedUnion` stores a discriminator followed by its selected schema. Unlike `union`, tagged values may have variable size.

## Schema reference

Every schema extends `Schema<TIn, TOut>` and supports:

- `pack(value)` to allocate and serialize a buffer.
- `unpack(buffer)` to deserialize from the start of a packed buffer.
- `write(cursor, value)`, `read(cursor)`, `getSize(value)`, and `skip(cursor)` for lower-level composition and cursor-based operations.

`InferSchemaIn<typeof schema>` and `InferSchemaOut<typeof schema>` extract a schema's input and output types. The `Schema` base class and these two type aliases are exported. `StructBuffer<T>` is also exported; it is the branded `ArrayBuffer` returned by `pack(value)` and accepted by `unpack(buffer)`, with `T` representing the schema's input type.

### Fixed-width primitives

| Input/output schema | Width | Values |
| --- | ---: | --- |
| `bool` / `Bool` | 1 byte | `boolean` |
| `u8` / `U8`, `i8` / `I8` | 1 byte | unsigned / signed 8-bit `number` |
| `u16` / `U16`, `i16` / `I16` | 2 bytes | unsigned / signed 16-bit `number` |
| `u32` / `U32`, `i32` / `I32` | 4 bytes | unsigned / signed 32-bit `number` |
| `u64` / `U64`, `i64` / `I64` | 8 bytes | 64-bit integer; input `number \| bigint`, output `bigint` |
| `f16` / `F16` | 2 bytes | half-precision `number` |
| `f32` / `F32` | 4 bytes | single-precision `number` |
| `f64` / `F64` | 8 bytes | double-precision `number` |

Lowercase names are reusable singleton schemas; uppercase names are classes that construct equivalent schemas. Integer writes use the corresponding `DataView` behavior for values outside the representable range.

```ts
import { i16, I16 } from '@sherlockdoyle/struct.ts';

// `i16` or `new I16(true)` uses little-endian byte order; for big-endian, use the following
const littleEndianBytes = i16.pack(0x1234);
const bigEndian = new I16(false);
const bigEndianBytes = bigEndian.pack(0x1234);
```

**Byte layout:** `i16.pack(0x1234)` is `[34 12]`; `new I16(false).pack(0x1234)` is `[12 34]`.

### Byte sequences and strings

| Export | Behavior |
| --- | --- |
| `Bytes(size)` / `bytes(size)` | Fixed number of bytes; `size` is provided to the class constructor or factory. |
| `Str` / `str` | UTF-8 string prefixed with its byte length as a 4-byte little-endian integer. |
| `CStr` / `cstr` | UTF-8 string terminated by a zero byte. |
| `Buffer` / `buf` | `Uint8Array` prefixed with its length as a 4-byte little-endian integer. |

### Enums, collections, and layout

| Export | Behavior |
| --- | --- |
| `Enum([values])` / `enum_(...values)` | Fixed-width schema for one of the listed values. |
| `Array_(schema)` / `array(schema)` / `array(schema, len)` | Length-prefixed array of values described by `schema`. Pass a second argument, such as `array(u16, 4)`, for a fixed-length array without the count prefix; it is fixed-size when its element schema is fixed-size. |
| `BoolArray` / `array(bool)` / `array(bool, len)` | Bit-packed length-prefixed boolean array; compact equivalent of `Array_(bool)`. Use `array(bool, len)` to omit the 4-byte count prefix and store exactly `len` bits; this form is fixed-size. |
| `Map_(keySchema, valueSchema)` / `map(keySchema, valueSchema)` | Length-prefixed map, with each key and value written by its schema. |
| `Pad(size)` / `pad(size)` | Fixed number of zero-filled reserved bytes when writing; reads and skips them. |
| `Struct(definition)` / `struct(definition)` | Named fields. Object definitions are ordered by field name; ordered definitions use `[[name, schema], ...]`. |
| `PartialStruct(definition)` / `struct(definition, true)` | A struct whose fixed-width fields can be left unchanged during `set(cursorOrBuffer, values)`. Variable-width fields cannot be omitted from a partial update. |
| `Tuple([schemas])` / `tuple(...schemas)` | Sequence of schemas represented as a typed tuple, with no count prefix. |
| `Concat([schemas])` / `concat(...schemas)` | Sequentially writes and merges the objects from multiple struct-like schemas. |

For `struct`, a definition may use schema objects, built-in schema names (`'u8'`, `'str'`, etc.), nested objects, or arrays of schemas (which define fixed tuples). Use `array(schema)` for variable-length arrays and `array(schema, len)` for fixed-length arrays without a count prefix. Ordered definitions use `[fieldName, schema]` entries and `[null, pad(size)]` for unnamed padding.

### Bit layouts and alternatives

| Export | Behavior |
| --- | --- |
| `Bitfield(definition)` / `bitfield(definition)` | Fixed-size schema that packs named signed, unsigned, and boolean fields into consecutive bits. Bit widths range from 1 to 32 and -1 to -32; negative widths indicate signed values. |
| `bitset(...names)` | Fixed-size schema that packs the named boolean fields into consecutive bits. |
| `Union(schemas)` / `union(schemas)` | Fixed-size overlay of fixed-width schemas. Pack input has one active key; unpack returns each alternative decoded from the same bytes. |
| `TaggedUnion(definition)` / `taggedUnion(definition)` | Discriminated union. Pack input is `{ type, value }`; unpack returns the matching pair. |
| `Optional(schema)` / `optional(schema)` | Adds a one-byte presence flag and encodes a value or `null`. |

### Custom schemas and utilities

| Export | Behavior |
| --- | --- |
| `custom(size, writeFn, readFn)` | Creates a fixed-width schema from callbacks. The callbacks receive the cursor and operate at its current offset; the schema advances the offset by `size`. |
| `datetime` | Fixed-size: encodes a `Date` as an 8-byte little-endian float containing milliseconds since the Unix epoch. |
| `uuid` | Fixed-size: encodes a UUID string as 16 bytes and unpacks it in lowercase, hyphenated form. |
| `LazySchema(schemaFn)` / `lazy(schemaFn)` | Defers schema creation until the first read, write, size, or skip operation. |
| `cursor(bufferLike, offset?)` | Creates a cursor for low-level schema operations. `bufferLike` is an `ArrayBuffer` or an object with an `ArrayBuffer` `buffer` property (like `Uint8Array` or `DataView`). |

### Recursive schemas

Use `lazy` when a schema refers to itself. The callback is evaluated on first use, so the schema variable can be referenced inside its own definition:

```ts
import { u8, struct, optional, lazy, type Schema } from '@sherlockdoyle/struct.ts';

// to use recursive schemas, you need to explicitly define the type
interface Node {
  value: number;
  next: Node | null;
}
const tree: Schema<Node> = struct({
  value: u8,
  next: lazy(() => optional(tree)),
});

const input: Node = {
  value: 1,
  next: {
    value: 2,
    next: null,
  },
};
const output = tree.unpack(tree.pack(input));
```

**Byte layout:** Object fields are alphabetical. Each node is
`[next present:1][next value if present][value:u8]`; the recursive tree has
variable size.

`lazy` works with any schema combinator, including `optional` for linked structures and `array` for trees. Recursive values should be finite so packing and unpacking can complete.
