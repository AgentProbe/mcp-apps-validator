import { describe, test, expect } from '@jest/globals'

import { McpAppsValidator } from '../../../src/McpAppsValidator.mjs'

import {
    TEST_ENDPOINT,
    FULL_VALID_CATEGORIES,
    EMPTY_CATEGORIES,
    MOCK_LATENCY
} from '../../helpers/config.mjs'


const makeSnapshot = ( { categoriesOverrides = {}, entriesOverrides = {} } = {} ) => {
    const base = {
        categories: { ...FULL_VALID_CATEGORIES, ...categoriesOverrides },
        entries: {
            endpoint: TEST_ENDPOINT,
            serverName: 'test-server',
            serverVersion: '1.0.0',
            serverDescription: 'Test',
            protocolVersion: '2025-03-26',
            extensionVersion: '2026-01-26',
            capabilities: {},
            uiResourceCount: 1,
            uiResources: [
                { uri: 'ui://dashboard', name: 'Dashboard', mimeType: 'text/html;profile=mcp-app', hasCsp: true, hasPermissions: true, displayModes: [] }
            ],
            uiLinkedToolCount: 1,
            uiLinkedTools: [
                { name: 'get_weather', resourceUri: 'ui://dashboard', visibility: [ 'model', 'app' ] }
            ],
            appOnlyToolCount: 0,
            cspSummary: { connectDomains: [], resourceDomains: [], frameDomains: [] },
            permissionsSummary: [],
            displayModes: [],
            tools: [],
            resources: [],
            latency: { ...MOCK_LATENCY },
            timestamp: '2026-02-07T10:00:00.000Z',
            ...entriesOverrides
        }
    }

    return base
}


describe( 'McpAppsValidator.compare', () => {

    describe( 'Parameter Validation', () => {

        test( 'throws when before is missing', () => {
            expect( () => {
                McpAppsValidator.compare( { after: makeSnapshot() } )
            } ).toThrow( 'VAL-510' )
        } )


        test( 'throws when after is missing', () => {
            expect( () => {
                McpAppsValidator.compare( { before: makeSnapshot() } )
            } ).toThrow( 'VAL-513' )
        } )


        test( 'throws when before is not an object', () => {
            expect( () => {
                McpAppsValidator.compare( { before: 'invalid', after: makeSnapshot() } )
            } ).toThrow( 'VAL-511' )
        } )


        test( 'throws when before is missing categories', () => {
            expect( () => {
                McpAppsValidator.compare( { before: { entries: {} }, after: makeSnapshot() } )
            } ).toThrow( 'VAL-512' )
        } )
    } )


    describe( 'No Changes', () => {

        test( 'detects no changes between identical snapshots', () => {
            const snapshot = makeSnapshot()

            const { status, hasChanges, diff } = McpAppsValidator.compare( { before: snapshot, after: snapshot } )

            expect( status ).toBe( true )
            expect( hasChanges ).toBe( false )
            expect( Object.keys( diff['server']['changed'] ) ).toHaveLength( 0 )
            expect( diff['uiResources']['added'] ).toHaveLength( 0 )
            expect( diff['uiResources']['removed'] ).toHaveLength( 0 )
        } )
    } )


    describe( 'Server Changes', () => {

        test( 'detects server version change', () => {
            const before = makeSnapshot()
            const after = makeSnapshot( { entriesOverrides: { serverVersion: '2.0.0' } } )

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['server']['changed']['serverVersion'] ).toEqual( {
                before: '1.0.0',
                after: '2.0.0'
            } )
        } )


        test( 'detects extension version change', () => {
            const before = makeSnapshot()
            const after = makeSnapshot( { entriesOverrides: { extensionVersion: '2026-06-01' } } )

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['server']['changed']['extensionVersion'] ).toBeDefined()
        } )
    } )


    describe( 'UI Resource Changes', () => {

        test( 'detects added UI resources', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['uiResources'].push( {
                uri: 'ui://new-resource',
                name: 'New Resource',
                mimeType: 'text/html;profile=mcp-app',
                hasCsp: false,
                hasPermissions: false,
                displayModes: []
            } )

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['uiResources']['added'] ).toContain( 'ui://new-resource' )
        } )


        test( 'detects removed UI resources', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['uiResources'] = []

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['uiResources']['removed'] ).toContain( 'ui://dashboard' )
        } )


        test( 'detects modified UI resources', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['uiResources'][0]['hasCsp'] = false

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['uiResources']['modified'] ).toHaveLength( 1 )
        } )
    } )


    describe( 'Tool Linkage Changes', () => {

        test( 'detects added linked tools', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['uiLinkedTools'].push( {
                name: 'new_tool',
                resourceUri: 'ui://dashboard',
                visibility: [ 'app' ]
            } )

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['uiLinkedTools']['added'] ).toContain( 'new_tool' )
        } )


        test( 'detects visibility changes', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['uiLinkedTools'][0]['visibility'] = [ 'app' ]

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['uiLinkedTools']['modified'] ).toHaveLength( 1 )
        } )
    } )


    describe( 'Category Changes', () => {

        test( 'detects category changes', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['categories']['hasValidCsp'] = false

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['categories']['changed']['hasValidCsp'] ).toEqual( {
                before: true,
                after: false
            } )
        } )
    } )


    describe( 'Latency Changes', () => {

        test( 'detects latency changes with delta', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['latency'] = { listResources: 120, readResource: 200 }

            const { hasChanges, diff } = McpAppsValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['latency']['changed']['listResources']['delta'] ).toBe( 40 )
            expect( diff['latency']['changed']['readResource']['delta'] ).toBe( 50 )
        } )
    } )


    describe( 'Snapshot Integrity', () => {

        test( 'reports CMP-001 for different endpoints', () => {
            const before = makeSnapshot()
            const after = makeSnapshot()
            after['entries']['endpoint'] = 'https://other-server.example.com/mcp'

            const { findings } = McpAppsValidator.compare( { before, after } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CMP-001', severity: 'warning', location: 'compare' } ) )
        } )


        test( 'reports CMP-002 for missing before timestamp', () => {
            const before = makeSnapshot()
            before['entries']['timestamp'] = null

            const after = makeSnapshot()

            const { findings } = McpAppsValidator.compare( { before, after } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CMP-002', severity: 'warning', location: 'compare' } ) )
        } )


        test( 'reports CMP-003 when after is older', () => {
            const before = makeSnapshot()
            before['entries']['timestamp'] = '2026-02-07T12:00:00.000Z'

            const after = makeSnapshot()
            after['entries']['timestamp'] = '2026-02-07T10:00:00.000Z'

            const { findings } = McpAppsValidator.compare( { before, after } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CMP-003', severity: 'warning', location: 'compare' } ) )
        } )
    } )


    describe( 'Diff Structure', () => {

        test( 'returns all diff sections', () => {
            const snapshot = makeSnapshot()

            const { diff } = McpAppsValidator.compare( { before: snapshot, after: snapshot } )

            expect( diff ).toHaveProperty( 'server' )
            expect( diff ).toHaveProperty( 'uiResources' )
            expect( diff ).toHaveProperty( 'uiLinkedTools' )
            expect( diff ).toHaveProperty( 'csp' )
            expect( diff ).toHaveProperty( 'permissions' )
            expect( diff ).toHaveProperty( 'latency' )
            expect( diff ).toHaveProperty( 'categories' )
        } )
    } )
} )
