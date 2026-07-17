import { CapabilityClassifier } from './task/CapabilityClassifier.mjs'
import { McpAppsConnector } from './task/McpAppsConnector.mjs'
import { SnapshotBuilder } from './task/SnapshotBuilder.mjs'
import { UiResourceValidator } from './task/UiResourceValidator.mjs'
import { Validation } from './task/Validation.mjs'


class McpAppsValidator {


    static async start( { endpoint, timeout = 10000 } ) {
        const { status: validationStatus, findings: validationFindings } = Validation.validationStart( { endpoint, timeout } )
        if( !validationStatus ) { Validation.error( { findings: validationFindings } ) }

        const { status: connectStatus, findings: connectFindings, client, serverInfo } = await McpAppsConnector.connect( { endpoint, timeout } )

        if( !connectStatus ) {
            const { categories, entries } = SnapshotBuilder.buildEmpty( { endpoint } )
            const findings = [ ...connectFindings ]

            return { status: false, findings, categories, entries }
        }

        const { findings, categories, entries } = await McpAppsValidator.#runPipeline( { endpoint, client, serverInfo, timeout } )

        await McpAppsConnector.disconnect( { client } )

        const allFindings = [ ...connectFindings, ...findings ]
        const status = allFindings.length === 0

        return { status, findings: allFindings, categories, entries }
    }


    static compare( { before, after } ) {
        const { status: validationStatus, findings: validationFindings } = Validation.validationCompare( { before, after } )
        if( !validationStatus ) { Validation.error( { findings: validationFindings } ) }

        const findings = []

        McpAppsValidator.#checkSnapshotIntegrity( { before, after, findings } )

        const { diff: serverDiff } = McpAppsValidator.#diffServer( { before: before['entries'], after: after['entries'] } )
        const { diff: uiResourcesDiff } = McpAppsValidator.#diffUiResources( { before: before['entries']['uiResources'] || [], after: after['entries']['uiResources'] || [] } )
        const { diff: uiLinkedToolsDiff } = McpAppsValidator.#diffUiLinkedTools( { before: before['entries']['uiLinkedTools'] || [], after: after['entries']['uiLinkedTools'] || [] } )
        const { diff: cspDiff } = McpAppsValidator.#diffCsp( { before: before['entries']['cspSummary'] || {}, after: after['entries']['cspSummary'] || {} } )
        const { diff: permissionsDiff } = McpAppsValidator.#diffPermissions( { before: before['entries']['permissionsSummary'] || [], after: after['entries']['permissionsSummary'] || [] } )
        const { diff: latencyDiff } = McpAppsValidator.#diffLatency( { before: before['entries']['latency'] || {}, after: after['entries']['latency'] || {} } )
        const { diff: categoriesDiff } = McpAppsValidator.#diffCategories( { before: before['categories'], after: after['categories'] } )

        const hasChanges = McpAppsValidator.#hasAnyChanges( { serverDiff, uiResourcesDiff, uiLinkedToolsDiff, cspDiff, permissionsDiff, latencyDiff, categoriesDiff } )

        const diff = {
            server: serverDiff,
            uiResources: uiResourcesDiff,
            uiLinkedTools: uiLinkedToolsDiff,
            csp: cspDiff,
            permissions: permissionsDiff,
            latency: latencyDiff,
            categories: categoriesDiff
        }

        const status = true

        return { status, findings, hasChanges, diff }
    }


    static async #runPipeline( { endpoint, client, serverInfo, timeout } ) {
        const allFindings = []

        const { findings: discoverFindings, tools, resources, capabilities } = await McpAppsConnector.discover( { client } )
        allFindings.push( ...discoverFindings )

        const { uiResources, uiLinkedTools } = McpAppsConnector.discoverUiResources( { resources, tools } )

        const { findings: validateFindings, validatedResources } = await UiResourceValidator.validate( { client, uiResources, tools, timeout } )
        allFindings.push( ...validateFindings )

        const { categories: partialCategories, findings: classifierFindings } = CapabilityClassifier.classify( { capabilities, uiResources, uiLinkedTools, validatedResources } )
        allFindings.push( ...classifierFindings )

        const { latency } = await McpAppsConnector.measureLatency( { client, uiResources } )

        const { categories, entries } = SnapshotBuilder.build( {
            endpoint,
            serverInfo,
            tools,
            resources,
            capabilities,
            partialCategories,
            uiResources,
            uiLinkedTools,
            validatedResources,
            latency
        } )

        return { findings: allFindings, categories, entries }
    }


    static #checkSnapshotIntegrity( { before, after, findings } ) {
        const beforeUrl = before['entries']['endpoint']
        const afterUrl = after['entries']['endpoint']

        if( beforeUrl !== afterUrl ) {
            findings.push( { code: 'CMP-001', severity: 'warning', location: 'compare', message: 'Snapshots are from different servers' } )
        }

        const beforeTimestamp = before['entries']['timestamp']
        const afterTimestamp = after['entries']['timestamp']

        if( !beforeTimestamp ) {
            findings.push( { code: 'CMP-002', severity: 'warning', location: 'compare', message: 'Before snapshot has no timestamp' } )
        }

        if( beforeTimestamp && afterTimestamp && afterTimestamp < beforeTimestamp ) {
            findings.push( { code: 'CMP-003', severity: 'warning', location: 'compare', message: 'After snapshot is older than before' } )
        }
    }


    static #diffServer( { before, after } ) {
        const changed = {}

        const fields = [ 'serverName', 'serverVersion', 'serverDescription', 'protocolVersion', 'extensionVersion' ]

        fields
            .forEach( ( field ) => {
                const beforeVal = before[field] || null
                const afterVal = after[field] || null

                if( beforeVal !== afterVal ) {
                    changed[field] = { before: beforeVal, after: afterVal }
                }
            } )

        return { diff: { changed } }
    }


    static #diffUiResources( { before, after } ) {
        const beforeUris = before
            .map( ( r ) => r['uri'] )

        const afterUris = after
            .map( ( r ) => r['uri'] )

        const added = afterUris
            .filter( ( uri ) => !beforeUris.includes( uri ) )

        const removed = beforeUris
            .filter( ( uri ) => !afterUris.includes( uri ) )

        const modified = []

        afterUris
            .filter( ( uri ) => beforeUris.includes( uri ) )
            .forEach( ( uri ) => {
                const beforeRes = before
                    .find( ( r ) => r['uri'] === uri )

                const afterRes = after
                    .find( ( r ) => r['uri'] === uri )

                const changes = []

                if( beforeRes['hasCsp'] !== afterRes['hasCsp'] ) {
                    changes.push( { field: 'hasCsp', before: beforeRes['hasCsp'], after: afterRes['hasCsp'] } )
                }

                if( beforeRes['hasPermissions'] !== afterRes['hasPermissions'] ) {
                    changes.push( { field: 'hasPermissions', before: beforeRes['hasPermissions'], after: afterRes['hasPermissions'] } )
                }

                if( JSON.stringify( beforeRes['displayModes'] ) !== JSON.stringify( afterRes['displayModes'] ) ) {
                    changes.push( { field: 'displayModes', before: beforeRes['displayModes'], after: afterRes['displayModes'] } )
                }

                if( changes.length > 0 ) {
                    modified.push( { uri, changes } )
                }
            } )

        return { diff: { added, removed, modified } }
    }


    static #diffUiLinkedTools( { before, after } ) {
        const beforeNames = before
            .map( ( t ) => t['name'] )

        const afterNames = after
            .map( ( t ) => t['name'] )

        const added = afterNames
            .filter( ( name ) => !beforeNames.includes( name ) )

        const removed = beforeNames
            .filter( ( name ) => !afterNames.includes( name ) )

        const modified = []

        afterNames
            .filter( ( name ) => beforeNames.includes( name ) )
            .forEach( ( name ) => {
                const beforeTool = before
                    .find( ( t ) => t['name'] === name )

                const afterTool = after
                    .find( ( t ) => t['name'] === name )

                const changes = []

                if( beforeTool['resourceUri'] !== afterTool['resourceUri'] ) {
                    changes.push( { field: 'resourceUri', before: beforeTool['resourceUri'], after: afterTool['resourceUri'] } )
                }

                if( JSON.stringify( beforeTool['visibility'] ) !== JSON.stringify( afterTool['visibility'] ) ) {
                    changes.push( { field: 'visibility', before: beforeTool['visibility'], after: afterTool['visibility'] } )
                }

                if( changes.length > 0 ) {
                    modified.push( { name, changes } )
                }
            } )

        return { diff: { added, removed, modified } }
    }


    static #diffCsp( { before, after } ) {
        const changed = {}

        const fields = [ 'connectDomains', 'resourceDomains', 'frameDomains' ]

        fields
            .forEach( ( field ) => {
                const beforeVal = JSON.stringify( before[field] || [] )
                const afterVal = JSON.stringify( after[field] || [] )

                if( beforeVal !== afterVal ) {
                    changed[field] = { before: before[field], after: after[field] }
                }
            } )

        return { diff: { changed } }
    }


    static #diffPermissions( { before, after } ) {
        const added = after
            .filter( ( p ) => !before.includes( p ) )

        const removed = before
            .filter( ( p ) => !after.includes( p ) )

        return { diff: { added, removed } }
    }


    static #diffLatency( { before, after } ) {
        const changed = {}

        const fields = [ 'listResources', 'readResource' ]

        fields
            .forEach( ( field ) => {
                const beforeVal = before[field]
                const afterVal = after[field]

                if( beforeVal !== null && afterVal !== null && beforeVal !== afterVal ) {
                    const delta = afterVal - beforeVal
                    changed[field] = { before: beforeVal, after: afterVal, delta }
                }
            } )

        const diff = { changed }

        return { diff }
    }


    static #diffCategories( { before, after } ) {
        const changed = {}

        Object.keys( before )
            .forEach( ( key ) => {
                if( before[key] !== after[key] ) {
                    changed[key] = { before: before[key], after: after[key] }
                }
            } )

        const diff = { changed }

        return { diff }
    }


    static #hasAnyChanges( { serverDiff, uiResourcesDiff, uiLinkedToolsDiff, cspDiff, permissionsDiff, latencyDiff, categoriesDiff } ) {
        const serverChanged = Object.keys( serverDiff['changed'] ).length > 0
        const uiResourcesChanged = uiResourcesDiff['added'].length > 0 || uiResourcesDiff['removed'].length > 0 || uiResourcesDiff['modified'].length > 0
        const uiLinkedToolsChanged = uiLinkedToolsDiff['added'].length > 0 || uiLinkedToolsDiff['removed'].length > 0 || uiLinkedToolsDiff['modified'].length > 0
        const cspChanged = Object.keys( cspDiff['changed'] ).length > 0
        const permissionsChanged = permissionsDiff['added'].length > 0 || permissionsDiff['removed'].length > 0
        const latencyChanged = Object.keys( latencyDiff['changed'] ).length > 0
        const categoriesChanged = Object.keys( categoriesDiff['changed'] ).length > 0

        const hasChanges = serverChanged || uiResourcesChanged || uiLinkedToolsChanged || cspChanged || permissionsChanged || latencyChanged || categoriesChanged

        return hasChanges
    }
}


export { McpAppsValidator }
