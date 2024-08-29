/**
 * @import {Program} from 'estree'
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {Parser} from 'acorn'
import {createVisitors} from 'estree-util-scope'
import {walk} from 'estree-walker'

test('estree-util-scope', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(await import('estree-util-scope')).sort(), [
      'createVisitors'
    ])
  })

  await t.test('should work', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('const a = 1', {ecmaVersion: 'latest'})
    )
    const visitors = createVisitors()

    walk(tree, {enter: visitors.enter, leave: visitors.exit})

    assert.deepEqual(visitors.scopes.at(-1), {block: false, defined: ['a']})
  })
})

test('scope creation', async function (t) {
  await t.test('should work on arrow functions', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('const a = (b) => b + 2', {ecmaVersion: 'latest'})
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'ArrowFunctionExpression') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['b']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })

  await t.test('should work on block statements', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('{let a = 1}', {ecmaVersion: 'latest'})
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'BlockStatement') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: true,
            defined: ['a']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })

  await t.test('should work on try/catch/finally', function () {
    const tree = /** @type {Program} */ (
      Parser.parse(
        'try { var a = 1; let b = 2 } catch (error) { throw 3 } finally { let c = 4 }',
        {ecmaVersion: 'latest'}
      )
    )
    let calls = 0
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'CatchClause') {
          calls++
          assert.deepEqual(visitors.scopes.at(-1), {
            block: true,
            defined: ['error']
          })
        } else if (node.type === 'Program') {
          calls++
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['a']
          })
        }

        visitors.exit(node)
      }
    })

    assert.equal(calls, 2)
  })

  await t.test('should work on classes', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('class A { b(c) { return c + 1 } }', {
        ecmaVersion: 'latest'
      })
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'FunctionExpression') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['c']
          })
        } else if (node.type === 'Program') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['A']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })

  await t.test('should work on function declarations', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('function a(b) { return b + 1 }', {ecmaVersion: 'latest'})
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'FunctionDeclaration') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['b']
          })
        } else if (node.type === 'Program') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['a']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })

  await t.test('should work on function expressions', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('const a = function b(c) { return c + 1 }', {
        ecmaVersion: 'latest'
      })
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'FunctionExpression') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['c']
          })
        } else if (node.type === 'Program') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['a', 'b']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })

  await t.test('should work on imports/exports', function () {
    const tree = /** @type {Program} */ (
      Parser.parse(
        'import a from "b";import c, {d} from "e";export const e = "f";export function g(h) {}',
        {ecmaVersion: 'latest', sourceType: 'module'}
      )
    )
    let called = false
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'Program') {
          called = true
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['a', 'c', 'd', 'e', 'g']
          })
        }

        visitors.exit(node)
      }
    })

    assert(called)
  })
})

test('scope setting', async function (t) {
  await t.test('should understand `var`, `let`, `const`', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('{var a = 1; let b = 2; const c = 3}', {
        ecmaVersion: 'latest'
      })
    )
    let calls = 0
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        if (node.type === 'Program') {
          calls++
          assert.deepEqual(visitors.scopes.at(-1), {
            block: false,
            defined: ['a']
          })
        } else if (node.type === 'BlockStatement') {
          calls++
          assert.deepEqual(visitors.scopes.at(-1), {
            block: true,
            defined: ['b', 'c']
          })
        }

        visitors.exit(node)
      }
    })

    assert.equal(calls, 2)
  })

  await t.test('should support array patterns', function () {
    const tree = /** @type {Program} */ (
      Parser.parse('var a = 1, [, b] = x(), {c = b, ...d} = y()', {
        ecmaVersion: 'latest'
      })
    )
    const visitors = createVisitors()

    walk(tree, {
      enter: visitors.enter,
      leave(node) {
        visitors.exit(node)
      }
    })

    assert.deepEqual(visitors.scopes.at(-1), {
      block: false,
      defined: ['a', 'b', 'c', 'd']
    })
  })
})
