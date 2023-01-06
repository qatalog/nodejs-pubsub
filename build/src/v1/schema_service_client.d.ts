/// <reference types="node" />
import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, PaginationCallback, IamClient, IamProtos } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/protos';
/**
 *  Service for doing schema-related operations.
 * @class
 * @memberof v1
 */
export declare class SchemaServiceClient {
    private _terminated;
    private _opts;
    private _providedCustomServicePath;
    private _gaxModule;
    private _gaxGrpc;
    private _protos;
    private _defaults;
    auth: gax.GoogleAuth;
    descriptors: Descriptors;
    warn: (code: string, message: string, warnType?: string) => void;
    innerApiCalls: {
        [name: string]: Function;
    };
    iamClient: IamClient;
    pathTemplates: {
        [name: string]: gax.PathTemplate;
    };
    schemaServiceStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of SchemaServiceClient.
     *
     * @param {object} [options] - The configuration object.
     * The options accepted by the constructor are described in detail
     * in [this document](https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#creating-the-client-instance).
     * The common options are:
     * @param {object} [options.credentials] - Credentials object.
     * @param {string} [options.credentials.client_email]
     * @param {string} [options.credentials.private_key]
     * @param {string} [options.email] - Account email address. Required when
     *     using a .pem or .p12 keyFilename.
     * @param {string} [options.keyFilename] - Full path to the a .json, .pem, or
     *     .p12 key downloaded from the Google Developers Console. If you provide
     *     a path to a JSON file, the projectId option below is not necessary.
     *     NOTE: .pem and .p12 require you to specify options.email as well.
     * @param {number} [options.port] - The port on which to connect to
     *     the remote host.
     * @param {string} [options.projectId] - The project ID from the Google
     *     Developer's Console, e.g. 'grape-spaceship-123'. We will also check
     *     the environment variable GCLOUD_PROJECT for your project ID. If your
     *     app is running in an environment which supports
     *     {@link https://developers.google.com/identity/protocols/application-default-credentials Application Default Credentials},
     *     your project ID will be detected automatically.
     * @param {string} [options.apiEndpoint] - The domain name of the
     *     API remote host.
     * @param {gax.ClientConfig} [options.clientConfig] - Client configuration override.
     *     Follows the structure of {@link gapicConfig}.
     * @param {boolean | "rest"} [options.fallback] - Use HTTP fallback mode.
     *     Pass "rest" to use HTTP/1.1 REST API instead of gRPC.
     *     For more information, please check the
     *     {@link https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#http11-rest-api-mode documentation}.
     * @param {gax} [gaxInstance]: loaded instance of `google-gax`. Useful if you
     *     need to avoid loading the default gRPC version and want to use the fallback
     *     HTTP implementation. Load only fallback version and pass it to the constructor:
     *     ```
     *     const gax = require('google-gax/build/src/fallback'); // avoids loading google-gax with gRPC
     *     const client = new SchemaServiceClient({fallback: 'rest'}, gax);
     *     ```
     */
    constructor(opts?: ClientOptions, gaxInstance?: typeof gax | typeof gax.fallback);
    /**
     * Initialize the client.
     * Performs asynchronous operations (such as authentication) and prepares the client.
     * This function will be called automatically when any class method is called for the
     * first time, but if you need to initialize it before calling an actual method,
     * feel free to call initialize() directly.
     *
     * You can await on this method if you want to make sure the client is initialized.
     *
     * @returns {Promise} A promise that resolves to an authenticated service stub.
     */
    initialize(): Promise<{
        [name: string]: Function;
    }>;
    /**
     * The DNS address for this API service.
     * @returns {string} The DNS address for this service.
     */
    static get servicePath(): string;
    /**
     * The DNS address for this API service - same as servicePath(),
     * exists for compatibility reasons.
     * @returns {string} The DNS address for this service.
     */
    static get apiEndpoint(): string;
    /**
     * The port for this API service.
     * @returns {number} The default port for this service.
     */
    static get port(): number;
    /**
     * The scopes needed to make gRPC calls for every method defined
     * in this service.
     * @returns {string[]} List of default scopes.
     */
    static get scopes(): string[];
    getProjectId(): Promise<string>;
    getProjectId(callback: Callback<string, undefined, undefined>): void;
    /**
     * Creates a schema.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to create the schema.
     *   Format is `projects/{project-id}`.
     * @param {google.pubsub.v1.Schema} request.schema
     *   Required. The schema object to create.
     *
     *   This schema's `name` parameter is ignored. The schema object returned
     *   by CreateSchema will have a `name` made using the given `parent` and
     *   `schema_id`.
     * @param {string} request.schemaId
     *   The ID to use for the schema, which will become the final component of
     *   the schema's resource name.
     *
     *   See https://cloud.google.com/pubsub/docs/admin#resource_names for resource
     *   name constraints.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [Schema]{@link google.pubsub.v1.Schema}.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
     *   for more details and examples.
     */
    createSchema(request?: protos.google.pubsub.v1.ICreateSchemaRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISchema,
        protos.google.pubsub.v1.ICreateSchemaRequest | undefined,
        {} | undefined
    ]>;
    createSchema(request: protos.google.pubsub.v1.ICreateSchemaRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISchema, protos.google.pubsub.v1.ICreateSchemaRequest | null | undefined, {} | null | undefined>): void;
    createSchema(request: protos.google.pubsub.v1.ICreateSchemaRequest, callback: Callback<protos.google.pubsub.v1.ISchema, protos.google.pubsub.v1.ICreateSchemaRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets a schema.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the schema to get.
     *   Format is `projects/{project}/schemas/{schema}`.
     * @param {google.pubsub.v1.SchemaView} request.view
     *   The set of fields to return in the response. If not set, returns a Schema
     *   with `name` and `type`, but not `definition`. Set to `FULL` to retrieve all
     *   fields.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [Schema]{@link google.pubsub.v1.Schema}.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
     *   for more details and examples.
     */
    getSchema(request?: protos.google.pubsub.v1.IGetSchemaRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISchema,
        protos.google.pubsub.v1.IGetSchemaRequest | undefined,
        {} | undefined
    ]>;
    getSchema(request: protos.google.pubsub.v1.IGetSchemaRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.ISchema, protos.google.pubsub.v1.IGetSchemaRequest | null | undefined, {} | null | undefined>): void;
    getSchema(request: protos.google.pubsub.v1.IGetSchemaRequest, callback: Callback<protos.google.pubsub.v1.ISchema, protos.google.pubsub.v1.IGetSchemaRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes a schema.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Name of the schema to delete.
     *   Format is `projects/{project}/schemas/{schema}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [Empty]{@link google.protobuf.Empty}.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
     *   for more details and examples.
     */
    deleteSchema(request?: protos.google.pubsub.v1.IDeleteSchemaRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.pubsub.v1.IDeleteSchemaRequest | undefined,
        {} | undefined
    ]>;
    deleteSchema(request: protos.google.pubsub.v1.IDeleteSchemaRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSchemaRequest | null | undefined, {} | null | undefined>): void;
    deleteSchema(request: protos.google.pubsub.v1.IDeleteSchemaRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.pubsub.v1.IDeleteSchemaRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Validates a schema.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to validate schemas.
     *   Format is `projects/{project-id}`.
     * @param {google.pubsub.v1.Schema} request.schema
     *   Required. The schema object to validate.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [ValidateSchemaResponse]{@link google.pubsub.v1.ValidateSchemaResponse}.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
     *   for more details and examples.
     */
    validateSchema(request?: protos.google.pubsub.v1.IValidateSchemaRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.IValidateSchemaResponse,
        protos.google.pubsub.v1.IValidateSchemaRequest | undefined,
        {} | undefined
    ]>;
    validateSchema(request: protos.google.pubsub.v1.IValidateSchemaRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.IValidateSchemaResponse, protos.google.pubsub.v1.IValidateSchemaRequest | null | undefined, {} | null | undefined>): void;
    validateSchema(request: protos.google.pubsub.v1.IValidateSchemaRequest, callback: Callback<protos.google.pubsub.v1.IValidateSchemaResponse, protos.google.pubsub.v1.IValidateSchemaRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Validates a message against a schema.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to validate schemas.
     *   Format is `projects/{project-id}`.
     * @param {string} request.name
     *   Name of the schema against which to validate.
     *
     *   Format is `projects/{project}/schemas/{schema}`.
     * @param {google.pubsub.v1.Schema} request.schema
     *   Ad-hoc schema against which to validate
     * @param {Buffer} request.message
     *   Message to validate against the provided `schema_spec`.
     * @param {google.pubsub.v1.Encoding} request.encoding
     *   The encoding expected for messages
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [ValidateMessageResponse]{@link google.pubsub.v1.ValidateMessageResponse}.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods)
     *   for more details and examples.
     */
    validateMessage(request?: protos.google.pubsub.v1.IValidateMessageRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.IValidateMessageResponse,
        protos.google.pubsub.v1.IValidateMessageRequest | undefined,
        {} | undefined
    ]>;
    validateMessage(request: protos.google.pubsub.v1.IValidateMessageRequest, options: CallOptions, callback: Callback<protos.google.pubsub.v1.IValidateMessageResponse, protos.google.pubsub.v1.IValidateMessageRequest | null | undefined, {} | null | undefined>): void;
    validateMessage(request: protos.google.pubsub.v1.IValidateMessageRequest, callback: Callback<protos.google.pubsub.v1.IValidateMessageResponse, protos.google.pubsub.v1.IValidateMessageRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Lists schemas in a project.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to list schemas.
     *   Format is `projects/{project-id}`.
     * @param {google.pubsub.v1.SchemaView} request.view
     *   The set of Schema fields to return in the response. If not set, returns
     *   Schemas with `name` and `type`, but not `definition`. Set to `FULL` to
     *   retrieve all fields.
     * @param {number} request.pageSize
     *   Maximum number of schemas to return.
     * @param {string} request.pageToken
     *   The value returned by the last `ListSchemasResponse`; indicates that
     *   this is a continuation of a prior `ListSchemas` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of [Schema]{@link google.pubsub.v1.Schema}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listSchemasAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination)
     *   for more details and examples.
     */
    listSchemas(request?: protos.google.pubsub.v1.IListSchemasRequest, options?: CallOptions): Promise<[
        protos.google.pubsub.v1.ISchema[],
        protos.google.pubsub.v1.IListSchemasRequest | null,
        protos.google.pubsub.v1.IListSchemasResponse
    ]>;
    listSchemas(request: protos.google.pubsub.v1.IListSchemasRequest, options: CallOptions, callback: PaginationCallback<protos.google.pubsub.v1.IListSchemasRequest, protos.google.pubsub.v1.IListSchemasResponse | null | undefined, protos.google.pubsub.v1.ISchema>): void;
    listSchemas(request: protos.google.pubsub.v1.IListSchemasRequest, callback: PaginationCallback<protos.google.pubsub.v1.IListSchemasRequest, protos.google.pubsub.v1.IListSchemasResponse | null | undefined, protos.google.pubsub.v1.ISchema>): void;
    /**
     * Equivalent to `method.name.toCamelCase()`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to list schemas.
     *   Format is `projects/{project-id}`.
     * @param {google.pubsub.v1.SchemaView} request.view
     *   The set of Schema fields to return in the response. If not set, returns
     *   Schemas with `name` and `type`, but not `definition`. Set to `FULL` to
     *   retrieve all fields.
     * @param {number} request.pageSize
     *   Maximum number of schemas to return.
     * @param {string} request.pageToken
     *   The value returned by the last `ListSchemasResponse`; indicates that
     *   this is a continuation of a prior `ListSchemas` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing [Schema]{@link google.pubsub.v1.Schema} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listSchemasAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination)
     *   for more details and examples.
     */
    listSchemasStream(request?: protos.google.pubsub.v1.IListSchemasRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listSchemas`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The name of the project in which to list schemas.
     *   Format is `projects/{project-id}`.
     * @param {google.pubsub.v1.SchemaView} request.view
     *   The set of Schema fields to return in the response. If not set, returns
     *   Schemas with `name` and `type`, but not `definition`. Set to `FULL` to
     *   retrieve all fields.
     * @param {number} request.pageSize
     *   Maximum number of schemas to return.
     * @param {string} request.pageToken
     *   The value returned by the last `ListSchemasResponse`; indicates that
     *   this is a continuation of a prior `ListSchemas` call, and that the
     *   system should return the next page of data.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows [async iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).
     *   When you iterate the returned iterable, each element will be an object representing
     *   [Schema]{@link google.pubsub.v1.Schema}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the
     *   [documentation](https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination)
     *   for more details and examples.
     */
    listSchemasAsync(request?: protos.google.pubsub.v1.IListSchemasRequest, options?: CallOptions): AsyncIterable<protos.google.pubsub.v1.ISchema>;
    /**
     * Gets the access control policy for a resource. Returns an empty policy
     * if the resource exists and does not have a policy set.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {Object} [request.options]
     *   OPTIONAL: A `GetPolicyOptions` object for specifying options to
     *   `GetIamPolicy`. This field is only used by Cloud IAM.
     *
     *   This object should have the same structure as [GetPolicyOptions]{@link google.iam.v1.GetPolicyOptions}
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See [gax.CallOptions]{@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing [Policy]{@link google.iam.v1.Policy}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [Policy]{@link google.iam.v1.Policy}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     */
    getIamPolicy(request: IamProtos.google.iam.v1.GetIamPolicyRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.GetIamPolicyRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.GetIamPolicyRequest | null | undefined, {} | null | undefined>): Promise<IamProtos.google.iam.v1.Policy>;
    /**
     * Returns permissions that a caller has on the specified resource. If the
     * resource does not exist, this will return an empty set of
     * permissions, not a NOT_FOUND error.
     *
     * Note: This operation is designed to be used for building
     * permission-aware UIs and command-line tools, not for authorization
     * checking. This operation may "fail open" without warning.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy detail is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {string[]} request.permissions
     *   The set of permissions to check for the `resource`. Permissions with
     *   wildcards (such as '*' or 'storage.*') are not allowed. For more
     *   information see
     *   [IAM Overview](https://cloud.google.com/iam/docs/overview#permissions).
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See [gax.CallOptions]{@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing [TestIamPermissionsResponse]{@link google.iam.v1.TestIamPermissionsResponse}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [TestIamPermissionsResponse]{@link google.iam.v1.TestIamPermissionsResponse}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     */
    setIamPolicy(request: IamProtos.google.iam.v1.SetIamPolicyRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.SetIamPolicyRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.Policy, IamProtos.google.iam.v1.SetIamPolicyRequest | null | undefined, {} | null | undefined>): Promise<IamProtos.google.iam.v1.Policy>;
    /**
     * Returns permissions that a caller has on the specified resource. If the
     * resource does not exist, this will return an empty set of
     * permissions, not a NOT_FOUND error.
     *
     * Note: This operation is designed to be used for building
     * permission-aware UIs and command-line tools, not for authorization
     * checking. This operation may "fail open" without warning.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.resource
     *   REQUIRED: The resource for which the policy detail is being requested.
     *   See the operation documentation for the appropriate value for this field.
     * @param {string[]} request.permissions
     *   The set of permissions to check for the `resource`. Permissions with
     *   wildcards (such as '*' or 'storage.*') are not allowed. For more
     *   information see
     *   [IAM Overview](https://cloud.google.com/iam/docs/overview#permissions).
     * @param {Object} [options]
     *   Optional parameters. You can override the default settings for this call, e.g, timeout,
     *   retries, paginations, etc. See [gax.CallOptions]{@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html} for the details.
     * @param {function(?Error, ?Object)} [callback]
     *   The function which will be called with the result of the API call.
     *
     *   The second parameter to the callback is an object representing [TestIamPermissionsResponse]{@link google.iam.v1.TestIamPermissionsResponse}.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing [TestIamPermissionsResponse]{@link google.iam.v1.TestIamPermissionsResponse}.
     *   The promise has a method named "cancel" which cancels the ongoing API call.
     *
     */
    testIamPermissions(request: IamProtos.google.iam.v1.TestIamPermissionsRequest, options?: gax.CallOptions | Callback<IamProtos.google.iam.v1.TestIamPermissionsResponse, IamProtos.google.iam.v1.TestIamPermissionsRequest | null | undefined, {} | null | undefined>, callback?: Callback<IamProtos.google.iam.v1.TestIamPermissionsResponse, IamProtos.google.iam.v1.TestIamPermissionsRequest | null | undefined, {} | null | undefined>): Promise<IamProtos.google.iam.v1.TestIamPermissionsResponse>;
    /**
     * Return a fully-qualified project resource name string.
     *
     * @param {string} project
     * @returns {string} Resource name string.
     */
    projectPath(project: string): string;
    /**
     * Parse the project from Project resource.
     *
     * @param {string} projectName
     *   A fully-qualified path representing Project resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromProjectName(projectName: string): string | number;
    /**
     * Return a fully-qualified projectTopic resource name string.
     *
     * @param {string} project
     * @param {string} topic
     * @returns {string} Resource name string.
     */
    projectTopicPath(project: string, topic: string): string;
    /**
     * Parse the project from ProjectTopic resource.
     *
     * @param {string} projectTopicName
     *   A fully-qualified path representing project_topic resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromProjectTopicName(projectTopicName: string): string | number;
    /**
     * Parse the topic from ProjectTopic resource.
     *
     * @param {string} projectTopicName
     *   A fully-qualified path representing project_topic resource.
     * @returns {string} A string representing the topic.
     */
    matchTopicFromProjectTopicName(projectTopicName: string): string | number;
    /**
     * Return a fully-qualified schema resource name string.
     *
     * @param {string} project
     * @param {string} schema
     * @returns {string} Resource name string.
     */
    schemaPath(project: string, schema: string): string;
    /**
     * Parse the project from Schema resource.
     *
     * @param {string} schemaName
     *   A fully-qualified path representing Schema resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSchemaName(schemaName: string): string | number;
    /**
     * Parse the schema from Schema resource.
     *
     * @param {string} schemaName
     *   A fully-qualified path representing Schema resource.
     * @returns {string} A string representing the schema.
     */
    matchSchemaFromSchemaName(schemaName: string): string | number;
    /**
     * Return a fully-qualified snapshot resource name string.
     *
     * @param {string} project
     * @param {string} snapshot
     * @returns {string} Resource name string.
     */
    snapshotPath(project: string, snapshot: string): string;
    /**
     * Parse the project from Snapshot resource.
     *
     * @param {string} snapshotName
     *   A fully-qualified path representing Snapshot resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSnapshotName(snapshotName: string): string | number;
    /**
     * Parse the snapshot from Snapshot resource.
     *
     * @param {string} snapshotName
     *   A fully-qualified path representing Snapshot resource.
     * @returns {string} A string representing the snapshot.
     */
    matchSnapshotFromSnapshotName(snapshotName: string): string | number;
    /**
     * Return a fully-qualified subscription resource name string.
     *
     * @param {string} project
     * @param {string} subscription
     * @returns {string} Resource name string.
     */
    subscriptionPath(project: string, subscription: string): string;
    /**
     * Parse the project from Subscription resource.
     *
     * @param {string} subscriptionName
     *   A fully-qualified path representing Subscription resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromSubscriptionName(subscriptionName: string): string | number;
    /**
     * Parse the subscription from Subscription resource.
     *
     * @param {string} subscriptionName
     *   A fully-qualified path representing Subscription resource.
     * @returns {string} A string representing the subscription.
     */
    matchSubscriptionFromSubscriptionName(subscriptionName: string): string | number;
    /**
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
