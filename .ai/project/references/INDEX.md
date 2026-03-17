# Reference Implementations

## Gold-standard Exchange Adapter
- **File**: `src/exchanges/ccxt-adapter.ts`
- **Why**: Cleanest implementation of `ExchangeAdapter` interface. Parameterized constructor pattern allows adding new CCXT exchanges with zero new code — just a config object. Good example of the adapter pattern.

## Gold-standard Slippage Engine
- **File**: `src/core/slippage.ts`
- **Why**: Pure function design — takes orderbook + params, returns result. No side effects, no state. Easy to test and reuse. Handles edge cases (insufficient liquidity, empty orderbook) gracefully.

## Gold-standard Custom Adapter
- **File**: `src/exchanges/sodex.ts`
- **Why**: Shows how to implement `ExchangeAdapter` for a non-CCXT exchange with a custom REST API. Handles pair mapping, orderbook normalization, and error recovery. Use as template for new DEX adapters (Aster, EdgeX).

## Monitor Loop Pattern
- **File**: `src/core/monitor.ts`
- **Why**: Recursive setTimeout pattern that prevents overlapping ticks. Good reference for any polling scheduler — handles slow ticks gracefully without accumulating drift.
