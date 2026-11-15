import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as S from './struct.js';

function roundTrip<TIn, TOut>(schema: S.Schema<TIn, TOut>, input: TIn, expected: TOut) {
  const packed = schema.pack(input);
  assert.equal(packed.byteLength, schema.getSize(input));
  assert.deepStrictEqual(schema.unpack(packed), expected);
  return packed;
}

test('fixed-width primitive schemas round-trip boundary values', () => {
  roundTrip(S.bool, false, false);
  roundTrip(new S.Bool(), true, true);
  roundTrip(S.u8, 0, 0);
  roundTrip(new S.U8(), 0xff, 0xff);
  roundTrip(S.u16, 0xffff, 0xffff);
  roundTrip(S.u32, 0xffffffff, 0xffffffff);
  roundTrip(S.u64, 0xfffffffffffff, 0xfffffffffffffn);
  roundTrip(S.u64, 0xffffffffffffffffn, 0xffffffffffffffffn);
  roundTrip(S.i8, -128, -128);
  roundTrip(S.i16, -32768, -32768);
  roundTrip(S.i32, -2147483648, -2147483648);
  roundTrip(S.i64, -0x8000000000000, -0x8000000000000n);
  roundTrip(S.i64, -0x8000000000000000n, -0x8000000000000000n);
  roundTrip(S.f16, -0, -0);
  roundTrip(S.f16, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  roundTrip(S.f32, Number.NaN, Number.NaN);
  roundTrip(S.f64, Number.MAX_VALUE, Number.MAX_VALUE);

  const bigEndian = new S.U16(false);
  const encoded = roundTrip(bigEndian, 0x1234, 0x1234);
  assert.deepStrictEqual([...new Uint8Array(encoded)], [0x12, 0x34]);
  assert.equal(S.bool.read(S.cursor(new Uint8Array([2]).buffer)), true); // any non-zero value is true
});

test('fixed and length-prefixed byte and string schemas handle empty and multibyte values', () => {
  roundTrip(new S.Bytes(0), new Uint8Array(), new Uint8Array());
  roundTrip(S.bytes(3), Uint8Array.of(0, 127, 255), Uint8Array.of(0, 127, 255));
  roundTrip(S.buf, new Uint8Array(), new Uint8Array());
  roundTrip(S.buf, Uint8Array.of(1, 2, 255), Uint8Array.of(1, 2, 255));
  roundTrip(S.str, '', '');
  roundTrip(new S.Str(), 'hello, 世界 🌍', 'hello, 世界 🌍');
  roundTrip(S.cstr, '', '');
  roundTrip(new S.CStr(), 'café', 'café');
  roundTrip(new S.Buffer(), Uint8Array.of(9, 8), Uint8Array.of(9, 8));
});

test('enum, array, map, tuple, optional, and padding schemas compose', () => {
  roundTrip(S.enum_('green', 'red', 'blue'), 'red', 'red');
  roundTrip(new S.Enum([2, 1, 3]), 2, 2);
  roundTrip(S.array(S.u16), [], []);
  roundTrip(S.array(S.bool), [true, false, true], [true, false, true]);
  roundTrip(S.array(S.u8), [0, 255], [0, 255]);
  roundTrip(new S.Array_(S.u8), [0, 255], [0, 255]);
  roundTrip(S.map(S.str, S.i8), new Map(), new Map());
  roundTrip(S.map(S.str, S.i8), new Map([['x', -2]]), new Map([['x', -2]]));
  roundTrip(S.tuple(S.bool, S.u16), [true, 0xffff], [true, 0xffff]);
  roundTrip(S.optional(S.str), null, null);
  roundTrip(S.optional(S.u8), 0, 0);
  roundTrip(S.pad(2), undefined, undefined);
});

test('struct supports ordered, nested compact, and partial definitions', () => {
  const ordered = S.struct([
    ['id', S.u16],
    [null, S.pad(1)],
    ['name', S.str],
  ]);
  roundTrip(ordered, { id: 0x1234, name: 'Ada' }, { id: 0x1234, name: 'Ada' });

  const compact = S.struct({
    active: 'bool',
    label: 'str',
    pair: ['u8', 'str'],
    values: S.array(S.u16),
  });
  roundTrip(
    compact,
    { active: true, label: 'compact', pair: [7, 'item'], values: [1, 65535] },
    { active: true, label: 'compact', pair: [7, 'item'], values: [1, 65535] },
  );

  const full = S.struct({ first: S.u8, second: S.u16, third: S.u8 });
  const partial = S.struct({ first: S.u8, second: S.u16, third: S.u8 }, true);
  const buffer = full.pack({ first: 1, second: 2, third: 3 });
  partial.set(buffer, { second: 0x1234 });
  assert.deepStrictEqual(full.unpack(buffer), { first: 1, second: 0x1234, third: 3 });
});

test('deeply nested structs, tuples, optionals, and arrays round-trip', () => {
  const schema = S.struct({
    root: {
      metadata: S.struct([
        ['id', 'u32'],
        ['tags', S.array(S.str)],
      ]),
      branches: S.array(
        S.struct({
          key: S.str,
          entries: S.array(S.tuple(S.i16, S.optional(S.str))),
          detail: {
            active: 'bool',
            code: S.optional(S.u16),
          },
        }),
      ),
    },
    position: [S.f32, S.f32],
  });
  const value: S.InferSchemaIn<typeof schema> = {
    root: {
      metadata: { id: 17, tags: ['root', 'deep'] },
      branches: [
        {
          key: 'branch-a',
          entries: [
            [1, 'one'],
            [-2, null],
          ],
          detail: { active: true, code: 0x1234 },
        },
        {
          key: 'branch-b',
          entries: [],
          detail: { active: false, code: null },
        },
      ],
    },
    position: [12.5, -4],
  };
  roundTrip(schema, value, value);
});

test('lazy schemas support recursive trees and nullable linked lists', () => {
  interface TreeNode {
    value: number;
    children: TreeNode[];
  }
  const tree: S.Schema<TreeNode> = S.struct({
    value: S.u8,
    children: S.lazy(() => S.array(tree)),
  });
  const input: TreeNode = {
    value: 1,
    children: [
      { value: 2, children: [{ value: 3, children: [] }] },
      { value: 4, children: [] },
    ],
  };
  roundTrip(tree, input, input);

  interface ListNode {
    value: string;
    next: ListNode | null;
  }
  const list: S.Schema<ListNode | null> = S.optional(S.struct({ value: S.str, next: S.lazy(() => list) }));
  roundTrip(list, null, null);

  let head: ListNode | null = null;
  for (let value = 19; value >= 0; value--) head = { value: String(value), next: head };
  roundTrip(list, head, head);
});

test('bitfield and bitset encode signed, unsigned, boolean, and reserved bits', () => {
  const schema = S.bitfield([
    ['signed', -5],
    ['active', S.bool],
    [null, 2],
    ['value', 8],
  ]);
  roundTrip(schema, { signed: -9, active: true, value: 255 }, { signed: -9, active: true, value: 255 });
  roundTrip(schema, { signed: 99, active: true, value: 255 }, { signed: 3 /* 99 % 16 */, active: true, value: 255 }); // overflow wrapping
  roundTrip(
    S.bitset('read', 'write', 'execute'),
    { read: true, write: false, execute: true },
    { read: true, write: false, execute: true },
  );
});

test('concat, union, and tagged union encode their documented layouts', () => {
  const first = S.struct({ id: S.u8 });
  const second = S.struct({ label: S.str });
  roundTrip(S.concat(first, second), { id: 4, label: 'joined' }, { id: 4, label: 'joined' });

  const overlay = S.union({ wide: S.u32, narrow: S.u16 });
  assert.deepStrictEqual(overlay.unpack(overlay.pack({ wide: 0x123456 })), {
    wide: 0x123456,
    narrow: 0x3456,
  });

  const tagged = S.taggedUnion({ text: S.str, count: S.u32 });
  roundTrip(tagged, { type: 'text', value: 'hello' }, { type: 'text', value: 'hello' });
  roundTrip(tagged, { type: 'count', value: 0xffffffff }, { type: 'count', value: 0xffffffff });
});

test('custom, datetime, uuid, lazy, and cursor operations work', () => {
  const custom = S.custom<number, string>(
    2,
    (cursor, value) => cursor.view.setUint16(cursor.offset, value, true),
    cursor => String(cursor.view.getUint16(cursor.offset, true)),
  );
  roundTrip(custom, 1234, '1234');
  roundTrip(S.datetime, new Date('2024-01-02T03:04:05.000Z'), new Date('2024-01-02T03:04:05.000Z'));

  const id = '00112233-4455-6677-8899-aabbccddeeff';
  const encodedId = roundTrip(S.uuid, id, id);
  assert.equal(encodedId.byteLength, 16);
  roundTrip(
    S.lazy(() => S.array(S.u8)),
    [0, 1, 255],
    [0, 1, 255],
  );

  const schema = S.tuple(S.str, S.array(S.u16), S.u8);
  const packed = schema.pack(['skip me', [1, 2], 3]);
  const readCursor = S.cursor(packed);
  schema.skip(readCursor);
  assert.equal(readCursor.offset, packed.byteLength);
  assert.equal(S.cursor({ buffer: packed }).offset, 0);
});

test('seeded random values round-trip through a nested struct', () => {
  let state = 0x12345678;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const labels = ['', 'plain', 'café', '🚀'];
  const schema = S.struct({
    active: 'bool',
    id: 'u32',
    score: 'i16',
    label: 'str',
    samples: S.array(S.u8),
    pair: ['u8', 'str'],
  });

  for (let i = 0; i < 100; i++) {
    const value: S.InferSchemaIn<typeof schema> = {
      active: random() >= 0.5,
      id: Math.floor(random() * 0x100000000),
      score: Math.floor(random() * 0x10000) - 0x8000,
      label: labels[Math.floor(random() * labels.length)],
      samples: Array.from({ length: Math.floor(random() * 8) }, () => Math.floor(random() * 256)),
      pair: [Math.floor(random() * 256), labels[Math.floor(random() * labels.length)]],
    };
    roundTrip(schema, value, value);
  }
});
