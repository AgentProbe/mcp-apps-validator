import { describe, test, expect } from '@jest/globals'

import { CapabilityClassifier } from '../../../src/task/CapabilityClassifier.mjs'

import {
    MOCK_CAPABILITIES,
    MOCK_CAPABILITIES_WITH_UI,
    MOCK_CAPABILITIES_WITH_UI_EXPERIMENTAL,
    MOCK_CAPABILITIES_WITH_UI_EXPERIMENTAL_NO_VERSION
} from '../../helpers/config.mjs'


const MOCK_UI_RESOURCES = [
    { uri: 'ui://dashboard', name: 'Dashboard' }
]

const MOCK_UI_LINKED_TOOLS = [
    { name: 'get_weather', resourceUri: 'ui://dashboard', visibility: [ 'model', 'app' ] },
    { name: 'refresh', resourceUri: 'ui://dashboard', visibility: [ 'app' ] }
]

const MOCK_VALIDATED_RESOURCES = [
    {
        uri: 'ui://dashboard',
        hasCsp: true,
        hasPermissions: true,
        hasTheming: true,
        displayModes: [ 'inline', 'fullscreen' ],
        hasGracefulDegradation: true
    }
]

const MOCK_VALIDATED_RESOURCES_MINIMAL = [
    {
        uri: 'ui://dashboard',
        hasCsp: false,
        hasPermissions: false,
        hasTheming: false,
        displayModes: [],
        hasGracefulDegradation: false
    }
]


describe( 'CapabilityClassifier', () => {

    test( 'classifies full capabilities correctly', () => {
        const { categories, findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI,
            uiResources: MOCK_UI_RESOURCES,
            uiLinkedTools: MOCK_UI_LINKED_TOOLS,
            validatedResources: MOCK_VALIDATED_RESOURCES
        } )

        expect( categories['supportsMcpApps'] ).toBe( true )
        expect( categories['hasUiResources'] ).toBe( true )
        expect( categories['hasUiToolLinkage'] ).toBe( true )
        expect( categories['hasValidUiHtml'] ).toBe( true )
        expect( categories['hasValidCsp'] ).toBe( true )
        expect( categories['supportsTheming'] ).toBe( true )
        expect( categories['supportsDisplayModes'] ).toBe( true )
        expect( categories['hasToolVisibility'] ).toBe( true )
        expect( categories['hasValidPermissions'] ).toBe( true )
        expect( categories['hasGracefulDegradation'] ).toBe( true )
        expect( findings ).toHaveLength( 0 )
    } )


    test( 'classifies empty capabilities correctly', () => {
        const { categories, findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( false )
        expect( categories['hasUiResources'] ).toBe( false )
        expect( categories['hasUiToolLinkage'] ).toBe( false )
        expect( categories['hasValidUiHtml'] ).toBe( false )
        expect( categories['hasValidCsp'] ).toBe( false )
        expect( categories['supportsTheming'] ).toBe( false )
        expect( categories['supportsDisplayModes'] ).toBe( false )
        expect( categories['hasGracefulDegradation'] ).toBe( false )
        expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-080', severity: 'info' } ) )
    } )


    test( 'detects io.modelcontextprotocol/ui extension', () => {
        const { categories } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( true )
    } )


    test( 'sets supportsMcpApps false when extension not present', () => {
        const { categories } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( false )
    } )


    test( 'sets hasValidCsp false when no CSP on validated resources', () => {
        const { categories } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI,
            uiResources: MOCK_UI_RESOURCES,
            uiLinkedTools: MOCK_UI_LINKED_TOOLS,
            validatedResources: MOCK_VALIDATED_RESOURCES_MINIMAL
        } )

        expect( categories['hasValidCsp'] ).toBe( false )
    } )


    test( 'handles null capabilities gracefully', () => {
        const { categories } = CapabilityClassifier.classify( {
            capabilities: null,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( false )
    } )


    test( 'returns 10 category keys', () => {
        const { categories } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( Object.keys( categories ).length ).toBe( 10 )
    } )


    test( 'returns UIV-080 when extension is missing', () => {
        const { findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv080 = findings
            .filter( ( f ) => f['code'] === 'UIV-080' )

        expect( uiv080 ).toHaveLength( 1 )
        expect( uiv080[0]['message'] ).toContain( 'MCP Apps extension not declared' )
    } )


    test( 'does not return UIV-080 when extension is present', () => {
        const { findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv080 = findings
            .filter( ( f ) => f['code'] === 'UIV-080' )

        expect( uiv080 ).toHaveLength( 0 )
    } )


    test( 'returns UIV-081 when extension exists but version is missing', () => {
        const capabilitiesNoVersion = {
            tools: {},
            resources: {},
            'io.modelcontextprotocol/ui': {}
        }

        const { findings } = CapabilityClassifier.classify( {
            capabilities: capabilitiesNoVersion,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv081 = findings
            .filter( ( f ) => f['code'] === 'UIV-081' )

        expect( uiv081 ).toHaveLength( 1 )
        expect( uiv081[0]['message'] ).toContain( 'Extension version not specified' )
    } )


    test( 'does not return UIV-081 when extension has version', () => {
        const { findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv081 = findings
            .filter( ( f ) => f['code'] === 'UIV-081' )

        expect( uiv081 ).toHaveLength( 0 )
    } )


    test( 'does not return UIV-081 when extension is not present', () => {
        const { findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv081 = findings
            .filter( ( f ) => f['code'] === 'UIV-081' )

        expect( uiv081 ).toHaveLength( 0 )
    } )


    test( 'returns findings array alongside categories', () => {
        const result = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( result ).toHaveProperty( 'categories' )
        expect( result ).toHaveProperty( 'findings' )
        expect( Array.isArray( result['findings'] ) ).toBe( true )
    } )


    test( 'detects extension under experimental fallback', () => {
        const { categories, findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI_EXPERIMENTAL,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( true )

        const uiv080 = findings
            .filter( ( f ) => f['code'] === 'UIV-080' )

        expect( uiv080 ).toHaveLength( 0 )
    } )


    test( 'extracts extension version from experimental fallback', () => {
        const { findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI_EXPERIMENTAL,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        const uiv081 = findings
            .filter( ( f ) => f['code'] === 'UIV-081' )

        expect( uiv081 ).toHaveLength( 0 )
    } )


    test( 'returns UIV-081 when experimental extension has no version', () => {
        const { categories, findings } = CapabilityClassifier.classify( {
            capabilities: MOCK_CAPABILITIES_WITH_UI_EXPERIMENTAL_NO_VERSION,
            uiResources: [],
            uiLinkedTools: [],
            validatedResources: []
        } )

        expect( categories['supportsMcpApps'] ).toBe( true )

        const uiv081 = findings
            .filter( ( f ) => f['code'] === 'UIV-081' )

        expect( uiv081 ).toHaveLength( 1 )
        expect( uiv081[0]['message'] ).toContain( 'Extension version not specified' )
    } )
} )
