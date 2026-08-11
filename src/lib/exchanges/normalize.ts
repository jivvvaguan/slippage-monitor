import type { Orderbook, OrderbookEntry } from './types';

/**
 * Rescale a book from one quoting unit to another.
 *
 * Venues disagree on how many underlying units a quoted unit represents:
 * SoDEX and Binance list 1000PEPE, Hyperliquid lists kPEPE, Bitget and OKX
 * list bare PEPE. Left alone, those mid prices differ by 1000x in the same
 * column and read as corrupt data.
 *
 * Price scales up and amount scales down by the same factor, so notional —
 * and therefore every slippage and depth figure — is untouched.
 */
export function rescaleOrderbook(book: Orderbook, factor: number): Orderbook {
  if (factor === 1) return book;

  const scale = (level: OrderbookEntry): OrderbookEntry => ({
    price: level.price * factor,
    amount: level.amount / factor,
  });

  return {
    ...book,
    bids: book.bids.map(scale),
    asks: book.asks.map(scale),
    midPrice: book.midPrice * factor,
  };
}

/**
 * Restate a book priced in some quote currency into USD.
 *
 * Unlike rescaleOrderbook this leaves amounts alone: sizes are already in the
 * base asset, so only the price needs converting and the notional follows.
 * Without it a JPY- or IDR-quoted book reports depth in yen or rupiah under a
 * dollar sign — Binance spot's most-traded BTC pair is BTC/IDR, whose raw
 * quote volume looks 4x larger than BTC/USDT until you divide by 16,000.
 */
export function convertQuoteToUsd(book: Orderbook, quoteUsd: number): Orderbook {
  if (quoteUsd === 1) return book;

  const scale = (level: OrderbookEntry): OrderbookEntry => ({
    price: level.price * quoteUsd,
    amount: level.amount,
  });

  return {
    ...book,
    bids: book.bids.map(scale),
    asks: book.asks.map(scale),
    midPrice: book.midPrice * quoteUsd,
  };
}
