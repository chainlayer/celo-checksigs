import { Address } from '@celo/contractkit'
import { eqAddress } from '@celo/utils/lib/address'
import { concurrentMap } from '@celo/utils/lib/async'
import { bitIsSet, parseBlockExtraData } from './istanbul'
import Web3 from 'web3'
import { newKit } from '@celo/contractkit'
import { Block } from 'web3'
import BigNumber from 'bignumber.js'


export type Bitmap = BigNumber

interface ValidatorStatusEntry {
  name: string
  address: Address
  signer: Address
  elected: boolean
  frontRunner: boolean
  signatures: number
  proposed: number
}

const url = 'http://localhost:8545'
const lookback = 40
const web3 = new Web3(url)
// const kit = newKitFromWeb3(web3)

const kit =  newKit('http://localhost:8545')

async function run() {
    const accounts = await kit.contracts.getAccounts()
    const validators = await kit.contracts.getValidators()
    const election = await kit.contracts.getElection()

    let signers: string[] = []
    const signer = await accounts.getValidatorSigner('775a5c899fd4a7cdd54e9f41738087748cfcb953')
    // const signer = '0xe12B4fe7D0050B1d852b28568b45fFAc548Cc6D4'
    signers = [signer]
    console.log(signer)

    const electedSigners = await election.getCurrentValidatorSigners()
    //console.log(electedSigners)
    const frontRunnerSigners = await election.electValidatorSigners()
    // console.log(frontRunnerSigners)

    // const latest = await web3.eth.getBlock('latest')
    const latest = await web3.eth.getBlock(118907)
    const blocks = await concurrentMap(10, [...Array(lookback).keys()], (i) =>
      web3.eth.getBlock(latest.number - i)
    )
    // console.log(blocks)

    const validatorStatuses = await concurrentMap(10, signers, (s) =>
      getStatus(s, blocks, electedSigners, frontRunnerSigners)
    )


//    console.log(parseBlockExtraData("0xd983010817846765746889676f312e31312e3133856c696e7578000000000000f8cbc0c080b84110c2fbdab3d57e1427497b366973fbd38f7863dd06267e1994d9835b3f5e97a70ba6bab8d73dab6730096360a043500e36694e52f3651e03f4bed2c9576a660b00f8408d0f9df7a66ff142bbf716758fffb0268568c03df03e2084ed5acb0c96dc73b52318e2bba9893576700a0d7672ade9c28310fb757a4e08f3c3aedc1645fc0080f8408d0ffdf73d7ffb57fffff7ffffffb01bb26c030be264ae17fd00eb7a0939a9546acf092df6e070e9bbbf03073fa7a9568a8c131f189983f052a573c0ff74008080"))
/*
*/
}

  async function getStatus(
    signer: Address,
    blocks: Block[],
    electedSigners: Address[],
    frontRunnerSigners: Address[]
  ): Promise<ValidatorStatusEntry> {
    const accounts = await kit.contracts.getAccounts()
    const validator = await accounts.signerToAccount(signer)
    // const validator = '0xe67a310436b8a3A23A994E4A0B29e8D82721bE7c'
    const name = (await accounts.getName(validator)) || ''
    const electedIndex = electedSigners.map((a) => eqAddress(a, signer)).indexOf(true)
    const frontRunnerIndex = frontRunnerSigners.map((a) => eqAddress(a, signer)).indexOf(true)
    const proposedCount = blocks.filter((b) => b.miner === signer).length
    let signedCount = 0
    if (electedIndex >= 0) {
      signedCount = blocks.filter((b) =>
        bitIsSetOverride(parseBlockExtraData(b.extraData).parentAggregatedSeal.bitmap, electedIndex, b.number)
      ).length
    }
console.log({
      name,
      address: validator,
      signer,
      elected: electedIndex >= 0,
      frontRunner: frontRunnerIndex >= 0,
      proposed: proposedCount,
      signatures: signedCount / blocks.length,
    })
    return {
      name,
      address: validator,
      signer,
      elected: electedIndex >= 0,
      frontRunner: frontRunnerIndex >= 0,
      proposed: proposedCount,
      signatures: signedCount / blocks.length,
    }
  }

function bitIsSetOverride(bitmap: Bitmap, index: number, blocknumber: number): boolean {
  let result = bitIsSet(bitmap, index)
  console.log(blocknumber, result)
  return result
}

run();
