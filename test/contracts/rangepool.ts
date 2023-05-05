/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { gBefore } from '../utils/hooks.test'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
  validateMint,
  BN_ZERO,
  validateSwap,
  validateBurn,
  PoolState,
  getTickAtPrice,
  getFeeGrowthGlobal,
} from '../utils/contracts/rangepool'

alice: SignerWithAddress
describe('RangePool Tests', function () {
  let tokenAmount: BigNumber
  let token0Decimals: number
  let token1Decimals: number
  let minPrice: BigNumber
  let maxPrice: BigNumber

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress

  ////////// DEBUG FLAGS //////////
  let debugMode           = false
  let balanceCheck        = true

  const liquidityAmount = BigNumber.from('49902591570441687020675')
  const liquidityAmount2 = BigNumber.from('50102591670431696268925')
  const liquidityAmount3 = BigNumber.from('3852877204305891777654')
  const minTickIdx = BigNumber.from('-887272')
  const maxTickIdx = BigNumber.from('887272')

  //every test should clear out all liquidity

  before(async function () {
    await gBefore()
    let currentBlock = await ethers.provider.getBlockNumber()
    //TODO: maybe just have one view function that grabs all these
    //TODO: map it to an interface
    const pool: PoolState = await hre.props.rangePool.poolState()
    const liquidity = pool.liquidity
    const feeGrowthGlobal0 = pool.feeGrowthGlobal0
    const feeGrowthGlobal1 = pool.feeGrowthGlobal1
    const price = pool.price
    const nearestTick = pool.tickAtPrice

    expect(liquidity).to.be.equal(BN_ZERO)

    minPrice = BigNumber.from('4295128739')
    maxPrice = BigNumber.from('1461446703485210103287273052203988822378723970341')
    token0Decimals = await hre.props.token0.decimals()
    token1Decimals = await hre.props.token1.decimals()
    tokenAmount = ethers.utils.parseUnits('100', token0Decimals)
    tokenAmount = ethers.utils.parseUnits('100', token1Decimals)
    alice = hre.props.alice
    bob = hre.props.bob
    carol = hre.props.carol
  })

  this.beforeEach(async function () {
    await mintSigners20(hre.props.token0, tokenAmount.mul(10), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(10), [hre.props.alice, hre.props.bob])
  })

  it('token1 - Should mint, swap, and burn 21', async function () {

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: false,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      liquidityIncrease: liquidityAmount,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount.div(10),
      sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('10053126651581942488'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '40',
      liquidityAmount: liquidityAmount,
      fungible: false,
      balance0Increase: BN_ZERO,
      balance1Increase: tokenAmount.sub(1),
      revertMessage: 'NotEnoughPositionLiquidity()',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      liquidityAmount: liquidityAmount.add(1),
      fungible: false,
      balance0Increase: BN_ZERO,
      balance1Increase: tokenAmount.sub(1),
      revertMessage: 'NotEnoughPositionLiquidity()',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      liquidityAmount: liquidityAmount,
      fungible: false,
      balance0Increase: BigNumber.from('10000000000000000000'),
      balance1Increase: BigNumber.from('89946873348418057511'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.rangePool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.rangePool.address)).toString())
    }
  })

  it('token0 - Should mint, swap, and burn 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    const aliceLiquidity = BigNumber.from('55483175795606442088768')

    if (debugMode) await getTickAtPrice()

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: false,
      balance0Decrease: BigNumber.from('11118295473149384055'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getTickAtPrice()

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('99620837864637861357'),
      balanceOutIncrease: BigNumber.from('99949999999999999999'),
      revertMessage: '',
    })

    if (debugMode) await getTickAtPrice()

    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      liquidityAmount: aliceLiquidity,
      fungible: false,
      balance0Increase: BigNumber.from('110739133337787245412'),
      balance1Increase: BigNumber.from('49999999999999999'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.rangePool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.rangePool.address)).toString())
    }
  })

  it('token0 - Should mint and burn fungible position 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      tokenAmount: BigNumber.from('419027207938949970576'),
      liquidityIncrease: BigNumber.from('419027207938949970576'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: (await hre.props.rangePool.poolState()).price.add(3),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: (await hre.props.rangePool.poolState()).price,
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: (await hre.props.rangePool.poolState()).price.sub(2),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    // reverts because fungible passed as false
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      liquidityAmount: BigNumber.from('170245243948753558591'),
      fungible: false,
      balance0Increase: BN_ZERO,
      balance1Increase: BN_ZERO,
      revertMessage: 'NotEnoughPositionLiquidity()',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      liquidityAmount: BigNumber.from('419027207938949970577'),
      fungible: true,
      balance0Increase: BN_ZERO,
      balance1Increase: BN_ZERO,
      revertMessage: 'BurnExceedsBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 2236771031221735906744102008774832778161797975119947154210717982934819779160, 419027207938949970577)',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      tokenAmount: BigNumber.from('419027207938949970576'),
      liquidityAmount: BigNumber.from('419027207938949970576'),
      fungible: true,
      balance0Increase: BigNumber.from('100000000000000000000'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })
  })

  it('token0 - Should add in-range fungible liquidity 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      tokenAmount: BigNumber.from('419027207938949970576'),
      liquidityIncrease: BigNumber.from('419027207938949970576'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('100000000000000000000'),
      balanceOutIncrease: BigNumber.from('32121736932093337716'),
      revertMessage: '',
    })

    // reverts because fungible passed as false
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      liquidityAmount: BigNumber.from('170245243948753558591'),
      fungible: false,
      balance0Increase: BN_ZERO,
      balance1Increase: BN_ZERO,
      revertMessage: 'NotEnoughPositionLiquidity()',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      liquidityAmount: BigNumber.from('419027207938949970577'),
      fungible: true,
      balance0Increase: BN_ZERO,
      balance1Increase: BN_ZERO,
      revertMessage: 'BurnExceedsBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 2236771031221735906744102008774832778161797975119947154210717982934819779160, 419027207938949970577)',
    })

    if (debugMode) await getTickAtPrice()

    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      tokenAmount: BigNumber.from('419027207938949970576'),
      liquidityAmount: BigNumber.from('419027207938949970576'),
      fungible: true,
      balance0Increase: BigNumber.from('67878263067906662283'),
      balance1Increase: BigNumber.from('100000000000000000000'),
      revertMessage: '',
    })
  })

  it('token1 - Should mint, swap, and burn 21', async function () {
    const liquidityAmount2 = BigNumber.from('690841800621472456980')

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: false,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: liquidityAmount2,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount.div(10),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('1345645380966504669'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '20000',
      upper: '30000',
      liquidityAmount: liquidityAmount2,
      fungible: true,
      balance0Increase: BN_ZERO,
      balance1Increase: tokenAmount.sub(1),
      revertMessage: 'BurnExceedsBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 46917584274566950978499300549752982364206881961648429939058743511297364061881, 690841800621472456980)',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '20000',
      upper: '30000',
      liquidityAmount: liquidityAmount2,
      fungible: false,
      balance0Increase: BigNumber.from('98654354619033495330'),
      balance1Increase: BigNumber.from('10000000000000000000'),
      revertMessage: '',
    })
  })

  it('token1 - Should mint, swap, and burn custom position while in range 21', async function () {
    if (debugMode) await getTickAtPrice()
    const aliceLiquidity = BigNumber.from('1577889144107833733009')
    const aliceLiquidity2 = BigNumber.from('1590926220637829792707')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: false,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount.div(10),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('819054826219841040'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: false,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('10082623526365456124'),
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '25000',
      upper: '30000',
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      fungible: false,
      balance0Increase: BigNumber.from('199180535441500909414'),
      balance1Increase: BigNumber.from('20082623526365456124'),
      revertMessage: '',
    })
  })

  it('token0 - Should autocompound fungible position 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('7703654602399898969634')
    const aliceLiquidity2 = BigNumber.from('7705754408611783555308')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      tokenAmount: aliceLiquidity,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount.div(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'),
      balanceOutIncrease: BigNumber.from('54487289918860678020'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('90970905615086187051'),
      tokenAmount: aliceToken2,
      liquidityIncrease: BigNumber.from('7705754408611783555308'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: BigNumber.from('11988250493261524638130'),
      liquidityAmount: BigNumber.from('11986657697951620560434'),
      fungible: true,
      balance0Increase: BigNumber.from('150000000000000000000'),
      balance1Increase: BigNumber.from('144243177493286617045'),
      revertMessage: 'BurnExceedsBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 2381093050879867228278279701469820094323623974324911225843268442440969283554, 11988250493261524638130)',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: aliceLiquidity.add(aliceToken2),
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      fungible: true,
      balance0Increase: BigNumber.from('150000000000000000000'),
      balance1Increase: BigNumber.from('136483615696225509030'),
      revertMessage: '',
    })
  })

  it('token0 - Should autocompound fungible position and add liquidity 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    const aliceLiquidity = BigNumber.from('7705754408611783555308')
    const aliceLiquidity2 = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('3851318661512648798121')

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('90970905615086187051'),
      tokenAmount: aliceLiquidity,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount.div(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('46172841786879071879'), // token0 decrease in pool
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount.div(4),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('25000000000000000000'),
      balanceOutIncrease: BigNumber.from('27122499921707680271'),
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('86165162340599335983'),
      balanceOutIncrease: BigNumber.from('78764658213120928119'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      tokenAmount: aliceToken2,
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: aliceLiquidity.add(aliceToken2).add(1),
      liquidityAmount: BigNumber.from('11986657697951620560434'),
      fungible: true,
      balance0Increase: BigNumber.from('153013648220322291925'),
      balance1Increase: BigNumber.from('144243177493286617045'),
      revertMessage: 'BurnExceedsBalance("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 2381093050879867228278279701469820094323623974324911225843268442440969283554, 11557073070124432353430)'
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: aliceLiquidity.add(aliceToken2),
      liquidityAmount: BigNumber.from('11559154372605880114611'), //TODO: investigate
      fungible: true,
      balance0Increase: BigNumber.from('62500000000000000'),
      balance1Increase: BigNumber.from('300013568033977842761'),
      revertMessage: '',
    })
  })

  it('token0 - Should mint position inside the other 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      tokenAmount: BigNumber.from('3852877204305891777654'),
      liquidityIncrease: BigNumber.from('3852877204305891777654'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amountIn: tokenAmount.div(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('54487289918860678020'), // token0 decrease in pool
      revertMessage: '',
    })

    if (debugMode) await getTickAtPrice()

    await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '200',
      upper: '600',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      tokenAmount: BigNumber.from('4901161634764542438934'),
      liquidityIncrease: BigNumber.from('4901161634764542438934'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.bob,
      lower: '200',
      upper: '600',
      tokenAmount: BigNumber.from('4901161634764542438934'),
      liquidityAmount: BigNumber.from('4901161634764542438934'),
      fungible: true,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('100000000000000000000'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: BigNumber.from('3852877204305891777654'),
      liquidityAmount: BigNumber.from('3852877204305891777654'),
      fungible: true,
      balance0Increase: BigNumber.from('50000000000000000000'),
      balance1Increase: BigNumber.from('45512710081139321979'),
      revertMessage: '',
    })
  })

  it('pool - Should mint position inside the other 21', async function () {
    const pool: PoolState = await hre.props.rangePool.poolState()
    const aliceLiquidity = BigNumber.from('7705754408611783555308')
    const bobLiquidity = BigNumber.from('12891478442546858467877')
    const bobLiquidity2 = BigNumber.from('4901161634764542438934')

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('90970905615086187051'),
      tokenAmount: aliceLiquidity,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amountIn: tokenAmount,
      sqrtPriceLimitX96: BigNumber.from('82255474610179467046984074964'),
      balanceInDecrease: BigNumber.from('8404133769503785680'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('7801206245756322179'), // token0 decrease in pool
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '600',
      upper: '800',
      amount0: tokenAmount,
      amount1: tokenAmount,
      fungible: true,
      balance0Decrease: BigNumber.from('31002239349424966834'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      tokenAmount: bobLiquidity,
      liquidityIncrease: bobLiquidity,
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      tokenAmount: bobLiquidity2,
      liquidityAmount: bobLiquidity2,
      fungible: true,
      balance0Increase: BigNumber.from('11786622206938309592'),
      balance1Increase: BigNumber.from('38018615604156121197'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      tokenAmount: bobLiquidity.sub(bobLiquidity2),
      liquidityAmount: bobLiquidity.sub(bobLiquidity2),
      fungible: true,
      balance0Increase: BigNumber.from('19215617142486657242'),
      balance1Increase: BigNumber.from('61981384395843878804'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      tokenAmount: aliceLiquidity,
      liquidityAmount: aliceLiquidity,
      fungible: true,
      balance0Increase: BigNumber.from('92198793754243677820'),
      balance1Increase: BigNumber.from('99375039384589972731'),
      revertMessage: '',
    })
  })
})