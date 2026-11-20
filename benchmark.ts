// AI generated benchmark

import { Bench } from 'tinybench';
import * as bin from 'typed-binary';
import * as borsh from 'borsh';
import { Packr } from 'msgpackr';
import * as S from './struct';

const packr = new Packr();

// ---------------------------------------------------------------------------
// 1. Schemas
// ---------------------------------------------------------------------------

// A. Flat primitives
const SFlat = S.struct({
  active: 'bool',
  flags: 'u8',
  id: 'i32',
  score: 'f32',
  ratio: 'f32',
});

const TBFlat = bin.object({
  active: bin.bool,
  flags: bin.byte,
  id: bin.i32,
  score: bin.f32,
  ratio: bin.f32,
});

const BorshFlat: borsh.Schema = {
  struct: {
    active: 'bool',
    flags: 'u8',
    id: 'i32',
    score: 'f32',
    ratio: 'f32',
  },
};

const flatData = {
  active: true,
  flags: 42,
  id: 123456789,
  score: 98.5,
  ratio: 0.75,
};

// B. Complex nested payload
const SComplex = S.struct({
  id: 'i32',
  name: 'cstr', // length-prefixed (matches borsh; typed-binary uses null-terminated)
  position: S.tuple(S.f32, S.f32, S.f32),
  nickname: S.optional(S.cstr),
  inventory: S.array(
    S.struct({
      itemId: 'i32',
      label: 'cstr',
      quantity: 'u8',
      equipped: 'bool',
    }),
  ),
  scores: S.array(S.i32),
});

const TBComplex = bin.object({
  id: bin.i32,
  name: bin.string,
  position: bin.tupleOf([bin.f32, bin.f32, bin.f32]),
  nickname: bin.optional(bin.string),
  inventory: bin.dynamicArrayOf(
    bin.object({
      itemId: bin.i32,
      label: bin.string,
      quantity: bin.byte,
      equipped: bin.bool,
    }),
  ),
  scores: bin.dynamicArrayOf(bin.i32),
});

const BorshComplex: borsh.Schema = {
  struct: {
    id: 'i32',
    name: 'string',
    position: { array: { type: 'f32', len: 3 } },
    nickname: { option: 'string' },
    inventory: {
      array: {
        type: {
          struct: {
            itemId: 'i32',
            label: 'string',
            quantity: 'u8',
            equipped: 'bool',
          },
        },
      },
    },
    scores: { array: { type: 'i32' } },
  },
};

const complexData = {
  id: 9001,
  name: 'player_one_character'.repeat(10),
  position: [12.5, -4.25, 1024.75] as [number, number, number],
  nickname: 'ace'.repeat(100),
  inventory: Array.from({ length: 20 }, (_, i) => ({
    itemId: 1000 + i,
    label: `item_slot_${i}`,
    quantity: (i % 10) + 1,
    equipped: i % 3 === 0,
  })),
  scores: Array.from({ length: 100 }, (_, i) => i * 17),
};

// ---------------------------------------------------------------------------
// 2. Pre-allocated buffers / encoded fixtures
// ---------------------------------------------------------------------------

// Flat
const sFlatBuf = SFlat.pack(flatData);
const sFlatCur = S.cursor(sFlatBuf);

const tbFlatSize = TBFlat.measure(flatData).size;
const tbFlatBuf = new ArrayBuffer(tbFlatSize);
const tbFlatWriter = new bin.BufferWriter(tbFlatBuf);
const tbFlatReader = new bin.BufferReader(tbFlatBuf);
TBFlat.write(tbFlatWriter, flatData);

const borshFlatBytes = borsh.serialize(BorshFlat, flatData, false);
const msgpackFlatBytes = packr.pack(flatData);

// Complex
const sComplexBuf = SComplex.pack(complexData);
const sComplexCur = S.cursor(sComplexBuf);

const tbComplexSize = TBComplex.measure(complexData).size;
const tbComplexBuf = new ArrayBuffer(tbComplexSize);
const tbComplexWriter = new bin.BufferWriter(tbComplexBuf);
const tbComplexReader = new bin.BufferReader(tbComplexBuf);
TBComplex.write(tbComplexWriter, complexData);

const borshComplexBytes = borsh.serialize(BorshComplex, complexData, false);
const msgpackComplexBytes = packr.pack(complexData);

// ---------------------------------------------------------------------------
// 3. Benchmarks
// ---------------------------------------------------------------------------

async function runSuite(name: string, register: (bench: Bench) => void) {
  const bench = new Bench({ time: 1000 });
  register(bench);
  await bench.run();
  console.log(`\n=== ${name} ===`);
  console.table(bench.table());
}

async function main() {
  console.log(
    `Flat size:    struct.ts=${sFlatBuf.byteLength}B | typed-binary=${tbFlatSize}B | borsh=${borshFlatBytes.byteLength}B | msgpackr=${msgpackFlatBytes.byteLength}B`,
  );
  console.log(
    `Complex size: struct.ts=${sComplexBuf.byteLength}B | typed-binary=${tbComplexSize}B | borsh=${borshComplexBytes.byteLength}B | msgpackr=${msgpackComplexBytes.byteLength}B`,
  );

  await runSuite('Flat Struct — Write / Serialize', b => {
    b.add('struct.ts (reused buf)', () => {
      sFlatCur.offset = 0;
      SFlat.write(sFlatCur, flatData);
    })
      .add('typed-binary (reused buf)', () => {
        tbFlatWriter.seekTo(0);
        TBFlat.write(tbFlatWriter, flatData);
      })
      .add('borsh (alloc)', () => {
        borsh.serialize(BorshFlat, flatData, false);
      })
      .add('msgpackr', () => {
        packr.pack(flatData);
      });
  });

  await runSuite('Flat Struct — Read / Deserialize', b => {
    b.add('struct.ts', () => {
      sFlatCur.offset = 0;
      SFlat.read(sFlatCur);
    })
      .add('typed-binary', () => {
        tbFlatReader.seekTo(0);
        TBFlat.read(tbFlatReader);
      })
      .add('borsh', () => {
        borsh.deserialize(BorshFlat, borshFlatBytes, false);
      })
      .add('msgpackr', () => {
        packr.unpack(msgpackFlatBytes);
      });
  });

  await runSuite('Complex Payload — Write / Serialize', b => {
    b.add('struct.ts (reused buf)', () => {
      sComplexCur.offset = 0;
      SComplex.write(sComplexCur, complexData);
    })
      .add('typed-binary (reused buf)', () => {
        tbComplexWriter.seekTo(0);
        TBComplex.write(tbComplexWriter, complexData);
      })
      .add('borsh (alloc)', () => {
        borsh.serialize(BorshComplex, complexData, false);
      })
      .add('msgpackr', () => {
        packr.pack(complexData);
      });
  });

  await runSuite('Complex Payload — Read / Deserialize', b => {
    b.add('struct.ts', () => {
      sComplexCur.offset = 0;
      SComplex.read(sComplexCur);
    })
      .add('typed-binary', () => {
        tbComplexReader.seekTo(0);
        TBComplex.read(tbComplexReader);
      })
      .add('borsh', () => {
        borsh.deserialize(BorshComplex, borshComplexBytes, false);
      })
      .add('msgpackr', () => {
        packr.unpack(msgpackComplexBytes);
      });
  });

  await runSuite('Complex Payload — Full Round-Trip (alloc + write + read)', b => {
    b.add('struct.ts', () => {
      const buf = SComplex.pack(complexData);
      SComplex.unpack(buf);
    })
      .add('typed-binary', () => {
        const size = TBComplex.measure(complexData).size;
        const buf = new ArrayBuffer(size);
        TBComplex.write(new bin.BufferWriter(buf), complexData);
        TBComplex.read(new bin.BufferReader(buf));
      })
      .add('borsh', () => {
        const bytes = borsh.serialize(BorshComplex, complexData, false);
        borsh.deserialize(BorshComplex, bytes, false);
      })
      .add('msgpackr', () => {
        const bytes = packr.pack(complexData);
        packr.unpack(bytes);
      });
  });
}

main();