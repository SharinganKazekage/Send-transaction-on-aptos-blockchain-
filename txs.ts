
export const NODE_URL = "https://fullnode.devnet.aptoslabs.com";

export const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

//Generate account interface
import { AptosAccount, TxnBuilderTypes, BCS, MaybeHexString } from "aptos";

//Aptos client faucet client
import { AptosClient, FaucetClient } from "aptos";

//Create a node client
const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);


//Helper method returns the coin balance associated with the account
export async function accountBalance(accountAddress: MaybeHexString): Promise<number | null> {
  const resource = await client.getAccountResource(accountAddress, "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
  if (resource == null) {
    return null;
  }

  return parseInt((resource.data as any)["coin"]["value"]);
}

/**
 * Transfer the given amount of coins from the given account to the recipient's account address。
 */
async function transfer(accountFrom: AptosAccount, recipient: MaybeHexString, amount: number): Promise<string> {
  //type tag structure
  const token = new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString("0x1::aptos_coin::AptosCoin"));

  //Transaction Load Script Function
  const entryFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      "0x1::coin",
      "transfer",
      [token],
      [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(recipient)), BCS.bcsSerializeUint64(amount)],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(accountFrom.address()),
    client.getChainId(),
  ]);

  //raw transaction processing
  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(accountFrom.address()),
    BigInt(sequenceNumber),
    entryFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  //Generate BCS transactions
  const bcsTxn = AptosClient.generateBCSTransaction(accountFrom, rawTxn);
  //Commit the signed BCS transaction
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);

  return pendingTxn.hash;
}


async function main() {
  //Create two accounts, A and B, and fund A but not B
  const a = new AptosAccount();
  const b = new AptosAccount();
  
  console.log("\n=== address ===");
  console.log(
    `A: ${a.address()} Key: ${Buffer.from(a.signingKey.secretKey).toString("hex").slice(0, 64)}`,
  );
  console.log(`B: ${b.address()} Key: ${Buffer.from(b.signingKey.secretKey).toString("hex").slice(0, 64)}`);

  //Faucet Leader Token
  await faucetClient.fundAccount(a.address(), 20000);
  await faucetClient.fundAccount(b.address(), 0);

  console.log("\n=== initial balance ===");
  console.log(`A: ${await accountBalance(a.address())}`);
  console.log(`B: ${await accountBalance(b.address())}`);

  // A transfers 1000 coins to B
  const txHash = await transfer(a, b.address(), 1000);
  await client.waitForTransaction(txHash);

  console.log("Txn Hash:", txHash);

  console.log("\n=== Account Balance ===");
  console.log(`A: ${await accountBalance(a.address())}`);
  console.log(`B: ${await accountBalance(b.address())}`);

}

if (require.main === module) {
  main();
}
