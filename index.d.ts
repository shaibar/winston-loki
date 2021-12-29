import TransportStream from "winston-transport";

declare interface LokiTransportOptions extends TransportStream.TransportStreamOptions{
    host: string;
    basicAuth?: string;
    headers?: object;
    interval?: number;
    json?: boolean;
    batching?: boolean;
    labels?: object;
    excludeDefaultLabels?: boolean;
    clearOnError?: boolean,
    replaceOnError?: boolean,
    replaceTimestamp?: boolean,
    gracefulShutdown?: boolean,
    timeout?: number,
}

declare class LokiTransport extends TransportStream {

    constructor(opts: LokiTransportOptions);
}

export = LokiTransport;
