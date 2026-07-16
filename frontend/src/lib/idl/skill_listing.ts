/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/skill_listing.json`.
 */
export type SkillListing = {
  "address": "5sqKpGv5sNVHR2ZXpWzQC3HiJELD4XwZzSP7Wi4qVnd1",
  "metadata": {
    "name": "skillListing",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "deactivateSkill",
      "docs": [
        "Soft-delete a skill (stays on-chain for audit; no longer resolvable)."
      ],
      "discriminator": [
        128,
        82,
        190,
        200,
        40,
        201,
        247,
        65
      ],
      "accounts": [
        {
          "name": "skill",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "account",
                "path": "skill.skill_id",
                "account": "skill"
              }
            ]
          }
        },
        {
          "name": "provider",
          "signer": true,
          "relations": [
            "skill"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "listSkill",
      "docs": [
        "Create a skill listing owned by `provider`."
      ],
      "discriminator": [
        247,
        246,
        237,
        238,
        50,
        56,
        112,
        182
      ],
      "accounts": [
        {
          "name": "skill",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "arg",
                "path": "skillId"
              }
            ]
          }
        },
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "skillId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "endpointUri",
          "type": "string"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "minReputation",
          "type": "u32"
        },
        {
          "name": "acceptedRails",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateSkill",
      "docs": [
        "Update price / min_reputation / endpoint / rails. Provider only."
      ],
      "discriminator": [
        116,
        142,
        164,
        86,
        9,
        27,
        112,
        227
      ],
      "accounts": [
        {
          "name": "skill",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "account",
                "path": "skill.skill_id",
                "account": "skill"
              }
            ]
          }
        },
        {
          "name": "provider",
          "signer": true,
          "relations": [
            "skill"
          ]
        }
      ],
      "args": [
        {
          "name": "price",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "minReputation",
          "type": {
            "option": "u32"
          }
        },
        {
          "name": "endpointUri",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "acceptedRails",
          "type": {
            "option": "u8"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "skill",
      "discriminator": [
        53,
        13,
        242,
        204,
        77,
        249,
        1,
        215
      ]
    }
  ],
  "events": [
    {
      "name": "skillListed",
      "discriminator": [
        208,
        44,
        218,
        161,
        21,
        136,
        102,
        16
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Name exceeds maximum length"
    },
    {
      "code": 6001,
      "name": "endpointUriTooLong",
      "msg": "Endpoint URI exceeds maximum length"
    },
    {
      "code": 6002,
      "name": "noRailsAccepted",
      "msg": "Must accept at least one payment rail"
    }
  ],
  "types": [
    {
      "name": "skill",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "skillId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "endpointUri",
            "type": "string"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "minReputation",
            "type": "u32"
          },
          {
            "name": "acceptedRails",
            "type": "u8"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "skillListed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "skillId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "minReputation",
            "type": "u32"
          }
        ]
      }
    }
  ]
};
