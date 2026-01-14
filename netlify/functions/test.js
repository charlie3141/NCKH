exports.handler = async function(event, context) {
    console.log('Test function called');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Function is working!',
            method: event.httpMethod,
            hasBody: !!event.body,
            bodyLength: event.body?.length,
            bodyPreview: event.body?.substring(0, 100),
            timestamp: new Date().toISOString()
        })
    };
};
