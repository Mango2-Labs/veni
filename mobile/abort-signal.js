// React Native's AbortSignal (the abort-controller package) predates reason, throwIfAborted(),
// AbortSignal.any() and AbortSignal.timeout(), which Kit uses while sending and confirming.
function abortError(name, message) {
  const error = new Error(message)
  error.name = name
  return error
}
const signalPrototype = AbortSignal.prototype
if (!('reason' in signalPrototype)) {
  const reasons = new WeakMap()
  Object.defineProperty(signalPrototype, 'reason', { configurable: true, get() { return reasons.get(this) } })
  const abort = AbortController.prototype.abort
  AbortController.prototype.abort = function (reason) {
    if (!this.signal.aborted) {
      reasons.set(this.signal, reason === undefined ? abortError('AbortError', 'This operation was aborted') : reason)
    }
    abort.call(this)
  }
}
if (!signalPrototype.throwIfAborted) {
  signalPrototype.throwIfAborted = function () {
    if (this.aborted) throw this.reason
  }
}
if (!AbortSignal.abort) {
  AbortSignal.abort = (reason) => {
    const controller = new AbortController()
    controller.abort(reason)
    return controller.signal
  }
}
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(abortError('TimeoutError', 'The operation timed out')), ms)
    return controller.signal
  }
}
if (!AbortSignal.any) {
  AbortSignal.any = (signals) => {
    const controller = new AbortController()
    const aborted = signals.find((signal) => signal.aborted)
    if (aborted) {
      controller.abort(aborted.reason)
      return controller.signal
    }
    const unsubscribers = signals.map((signal) => {
      const onAbort = () => {
        controller.abort(signal.reason)
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
      signal.addEventListener('abort', onAbort)
      return () => signal.removeEventListener('abort', onAbort)
    })
    return controller.signal
  }
}
