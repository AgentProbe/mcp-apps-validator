class Validation {


    static validationStart( { endpoint, timeout } ) {
        const struct = { status: false, findings: [] }

        if( endpoint === undefined ) {
            struct['findings'].push( { code: 'VAL-501', severity: 'error', location: 'endpoint', message: 'Missing value' } )
        } else if( typeof endpoint !== 'string' ) {
            struct['findings'].push( { code: 'VAL-502', severity: 'error', location: 'endpoint', message: 'Must be a string' } )
        } else if( endpoint.trim() === '' ) {
            struct['findings'].push( { code: 'VAL-503', severity: 'error', location: 'endpoint', message: 'Must not be empty' } )
        } else {
            try {
                new URL( endpoint )
            } catch( _e ) {
                struct['findings'].push( { code: 'VAL-504', severity: 'error', location: 'endpoint', message: 'Must be a valid URL' } )
            }
        }

        if( timeout !== undefined ) {
            if( typeof timeout !== 'number' ) {
                struct['findings'].push( { code: 'VAL-505', severity: 'error', location: 'timeout', message: 'Must be a number' } )
            } else if( timeout <= 0 ) {
                struct['findings'].push( { code: 'VAL-506', severity: 'error', location: 'timeout', message: 'Must be greater than 0' } )
            }
        }

        if( struct['findings'].length > 0 ) {
            return struct
        }

        struct['status'] = true

        return struct
    }


    static validationCompare( { before, after } ) {
        const struct = { status: false, findings: [] }

        if( before === undefined ) {
            struct['findings'].push( { code: 'VAL-510', severity: 'error', location: 'before', message: 'Missing value' } )
        } else if( before === null || typeof before !== 'object' || Array.isArray( before ) ) {
            struct['findings'].push( { code: 'VAL-511', severity: 'error', location: 'before', message: 'Must be an object' } )
        } else if( !before['categories'] || !before['entries'] ) {
            struct['findings'].push( { code: 'VAL-512', severity: 'error', location: 'before', message: 'Missing categories or entries' } )
        }

        if( after === undefined ) {
            struct['findings'].push( { code: 'VAL-513', severity: 'error', location: 'after', message: 'Missing value' } )
        } else if( after === null || typeof after !== 'object' || Array.isArray( after ) ) {
            struct['findings'].push( { code: 'VAL-514', severity: 'error', location: 'after', message: 'Must be an object' } )
        } else if( !after['categories'] || !after['entries'] ) {
            struct['findings'].push( { code: 'VAL-515', severity: 'error', location: 'after', message: 'Missing categories or entries' } )
        }

        if( struct['findings'].length > 0 ) {
            return struct
        }

        struct['status'] = true

        return struct
    }


    static error( { findings } ) {
        const messageStr = findings
            .map( ( finding ) => `${finding['code']} ${finding['location']}: ${finding['message']}` )
            .join( ', ' )

        throw new Error( messageStr )
    }
}


export { Validation }
