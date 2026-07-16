import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { AgentRegistry } from "../target/types/agent_registry";
import { assert } from "chai";

describe("agent_registry", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.AgentRegistry as Program<AgentRegistry>;

  const [counterPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    program.programId
  );

  const agentFor = (owner: web3.PublicKey) =>
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), owner.toBuffer()],
      program.programId
    )[0];

  it("initializes the counter", async () => {
    try {
      await program.methods.initCounter().accounts({ payer: provider.wallet.publicKey }).rpc();
    } catch (e: any) {
      if (!String(e).includes("already in use")) throw e;
    }
    const counter = await program.account.counter.fetch(counterPda);
    assert.ok(counter.nextId.toNumber() >= 1);
  });

  it("registers a new agent", async () => {
    const owner = web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(owner.publicKey, 1e9);
    await provider.connection.confirmTransaction(sig);

    const uri = "ipfs://QmTestAgentMetadata";
    await program.methods
      .registerAgent(uri)
      .accounts({ owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const agent = await program.account.agent.fetch(agentFor(owner.publicKey));
    assert.equal(agent.owner.toBase58(), owner.publicKey.toBase58());
    assert.equal(agent.metadataUri, uri);
    assert.ok(agent.agentId.toNumber() >= 1);
  });

  it("rejects double-registration by same owner", async () => {
    const owner = web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(owner.publicKey, 1e9);
    await provider.connection.confirmTransaction(sig);

    await program.methods
      .registerAgent("ipfs://one")
      .accounts({ owner: owner.publicKey })
      .signers([owner])
      .rpc();

    let threw = false;
    try {
      await program.methods
        .registerAgent("ipfs://two")
        .accounts({ owner: owner.publicKey })
        .signers([owner])
        .rpc();
    } catch {
      threw = true;
    }
    assert.isTrue(threw, "second register_agent should have failed");
  });

  it("updates metadata for owner only", async () => {
    const owner = web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(owner.publicKey, 1e9);
    await provider.connection.confirmTransaction(sig);

    await program.methods
      .registerAgent("ipfs://initial")
      .accounts({ owner: owner.publicKey })
      .signers([owner])
      .rpc();

    await program.methods
      .updateMetadata("ipfs://updated")
      .accounts({ owner: owner.publicKey })
      .signers([owner])
      .rpc();

    const agent = await program.account.agent.fetch(agentFor(owner.publicKey));
    assert.equal(agent.metadataUri, "ipfs://updated");
  });

  it("rejects metadata longer than limit", async () => {
    const owner = web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(owner.publicKey, 1e9);
    await provider.connection.confirmTransaction(sig);

    let threw = false;
    try {
      await program.methods
        .registerAgent("x".repeat(201))
        .accounts({ owner: owner.publicKey })
        .signers([owner])
        .rpc();
    } catch {
      threw = true;
    }
    assert.isTrue(threw, "over-length metadata should fail");
  });
});
