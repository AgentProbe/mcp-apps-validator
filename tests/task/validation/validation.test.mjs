import { describe, test, expect } from '@jest/globals'

import { Validation } from '../../../src/task/Validation.mjs'

import { TEST_ENDPOINT } from '../../helpers/config.mjs'


describe( 'Validation', () => {

    describe( 'validationStart', () => {

        test( 'returns error when endpoint is missing', () => {
            const { status, findings } = Validation.validationStart( {} )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-501', severity: 'error' } ) )
        } )


        test( 'returns error when endpoint is not a string', () => {
            const { status, findings } = Validation.validationStart( { endpoint: 42 } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-502', severity: 'error' } ) )
        } )


        test( 'returns error when endpoint is empty', () => {
            const { status, findings } = Validation.validationStart( { endpoint: '  ' } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-503', severity: 'error' } ) )
        } )


        test( 'returns error when endpoint is invalid URL', () => {
            const { status, findings } = Validation.validationStart( { endpoint: 'not-a-url' } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-504', severity: 'error' } ) )
        } )


        test( 'returns error when timeout is not a number', () => {
            const { status, findings } = Validation.validationStart( { endpoint: TEST_ENDPOINT, timeout: 'fast' } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-505', severity: 'error' } ) )
        } )


        test( 'returns error when timeout is zero', () => {
            const { status, findings } = Validation.validationStart( { endpoint: TEST_ENDPOINT, timeout: 0 } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-506', severity: 'error' } ) )
        } )


        test( 'returns error when timeout is negative', () => {
            const { status, findings } = Validation.validationStart( { endpoint: TEST_ENDPOINT, timeout: -1 } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-506', severity: 'error' } ) )
        } )


        test( 'returns success with valid endpoint', () => {
            const { status, findings } = Validation.validationStart( { endpoint: TEST_ENDPOINT } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )


        test( 'returns success with valid endpoint and timeout', () => {
            const { status, findings } = Validation.validationStart( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )


        test( 'emits structured findings with location and message', () => {
            const { findings } = Validation.validationStart( {} )

            expect( findings[0] ).toEqual( { code: 'VAL-501', severity: 'error', location: 'endpoint', message: 'Missing value' } )
        } )
    } )


    describe( 'validationCompare', () => {

        const validSnapshot = {
            categories: { isReachable: true },
            entries: { endpoint: TEST_ENDPOINT }
        }


        test( 'returns error when before is missing', () => {
            const { status, findings } = Validation.validationCompare( { after: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-510', severity: 'error' } ) )
        } )


        test( 'returns error when before is not an object', () => {
            const { status, findings } = Validation.validationCompare( { before: 'invalid', after: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-511', severity: 'error' } ) )
        } )


        test( 'returns error when before is null', () => {
            const { status, findings } = Validation.validationCompare( { before: null, after: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-511', severity: 'error' } ) )
        } )


        test( 'returns error when before is an array', () => {
            const { status, findings } = Validation.validationCompare( { before: [], after: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-511', severity: 'error' } ) )
        } )


        test( 'returns error when before is missing categories or entries', () => {
            const { status, findings } = Validation.validationCompare( { before: { foo: true }, after: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-512', severity: 'error' } ) )
        } )


        test( 'returns error when after is missing', () => {
            const { status, findings } = Validation.validationCompare( { before: validSnapshot } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-513', severity: 'error' } ) )
        } )


        test( 'returns error when after is not an object', () => {
            const { status, findings } = Validation.validationCompare( { before: validSnapshot, after: 42 } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-514', severity: 'error' } ) )
        } )


        test( 'returns error when after is missing categories or entries', () => {
            const { status, findings } = Validation.validationCompare( { before: validSnapshot, after: { foo: true } } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'VAL-515', severity: 'error' } ) )
        } )


        test( 'returns success with valid snapshots', () => {
            const { status, findings } = Validation.validationCompare( { before: validSnapshot, after: validSnapshot } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )
    } )


    describe( 'error', () => {

        test( 'throws with joined findings', () => {
            expect( () => {
                Validation.error( { findings: [
                    { code: 'VAL-501', severity: 'error', location: 'endpoint', message: 'Missing value' },
                    { code: 'VAL-505', severity: 'error', location: 'timeout', message: 'Must be a number' }
                ] } )
            } ).toThrow( 'VAL-501 endpoint: Missing value, VAL-505 timeout: Must be a number' )
        } )


        test( 'throws with single finding', () => {
            expect( () => {
                Validation.error( { findings: [
                    { code: 'VAL-501', severity: 'error', location: 'endpoint', message: 'Missing value' }
                ] } )
            } ).toThrow( 'VAL-501 endpoint: Missing value' )
        } )
    } )
} )
