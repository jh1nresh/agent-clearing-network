/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/reputation_ledger.json`.
 */
export type ReputationLedger = {
  "address": "BmhJPfUSCnrX2ctUcGCHJ6xLL8RwkWXU9VdxMAHHAH46",
  "metadata": {
    "name": "reputationLedger",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeReputation",
      "docs": [
        "Initialize reputation for an agent. Anyone can fund this once."
      ],
      "discriminator": [
        150,
        240,
        109,
        53,
        147,
        42,
        152,
        162
      ],
      "accounts": [
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agent"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "recordCompletion",
      "docs": [
        "Record a job outcome. Gated: only the job_escrow program's job PDA may call.",
        "CPI path: job_escrow::accept_result / reject_result signs with the job PDA."
      ],
      "discriminator": [
        209,
        113,
        91,
        75,
        66,
        137,
        244,
        157
      ],
      "accounts": [
        {
          "name": "reputation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  117,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "agent"
        },
        {
          "name": "jobAuthority",
          "docs": [
            "Gating: this signer MUST be the job PDA from the job_escrow program.",
            "seeds::program pins derivation to JOB_ESCROW_PROGRAM_ID, so no other",
            "program and no user-controlled key can satisfy this constraint."
          ],
          "signer": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "arg",
                "path": "client"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                43,
                107,
                59,
                217,
                87,
                192,
                241,
                164,
                79,
                24,
                53,
                78,
                111,
                64,
                21,
                100,
                32,
                48,
                51,
                38,
                51,
                202,
                198,
                94,
                22,
                36,
                221,
                229,
                92,
                251,
                214,
                242
              ]
            }
          }
        }
      ],
      "args": [
        {
          "name": "client",
          "type": "pubkey"
        },
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "success",
          "type": "bool"
        },
        {
          "name": "volume",
          "type": "u64"
        },
        {
          "name": "latencyMs",
          "type": "u32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "reputation",
      "discriminator": [
        55,
        148,
        90,
        71,
        68,
        183,
        193,
        28
      ]
    }
  ],
  "events": [
    {
      "name": "reputationInitialized",
      "discriminator": [
        167,
        122,
        115,
        118,
        198,
        80,
        35,
        69
      ]
    },
    {
      "name": "reputationUpdated",
      "discriminator": [
        26,
        36,
        187,
        150,
        235,
        90,
        106,
        89
      ]
    }
  ],
  "types": [
    {
      "name": "reputation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "completedJobs",
            "type": "u64"
          },
          {
            "name": "rejectedJobs",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u128"
          },
          {
            "name": "avgLatencyMs",
            "type": "u32"
          },
          {
            "name": "score",
            "type": "u64"
          },
          {
            "name": "lastUpdate",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reputationInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "reputationUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "volume",
            "type": "u64"
          },
          {
            "name": "score",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
