#!/usr/bin/env node

'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');

const yaml = require('yaml');
const fetch = require('node-fetch-h2');

const resolver = require('./index.js');

let argv = require('yargs')
    .string('output')
    .alias('o','output')
    .describe('output','file to output to')
    .default('output','resolved.yaml')
    .count('quiet')
    .alias('q','quiet')
    .describe('quiet','reduce verbosity')
    .count('verbose')
    .default('verbose',2)
    .alias('v','verbose')
    .describe('verbose','increase verbosity')
    .string('droprefs')
    .describe('droprefs', 'regexp for $refs to be left unresolved')
    .boolean('resolveInternal')
    .describe('resolveInternal', 'resolve all internal references')
    .boolean('jsonOutput')
    .describe('jsonOutput', 'write result as JSON rather than yaml')
    .boolean('yamlMerge')
    .describe('yamlMerge', 'resolve yaml merge key <<  see https://yaml.org/type/merge.html')
    .demand(1)
    .argv;

let filespec = argv._[0];

let options = {resolve: true};

options.verbose = argv.verbose;
if (argv.quiet) options.verbose = options.verbose - argv.quiet;
options.fatal = true;

options.dropRefs = argv.droprefs ? new RegExp(argv.droprefs, 'g') : null;
options.resolveInternal = argv.resolveInternal;
options.jsonOutput = argv.jsonOutput;
options.yamlMerge = argv.yamlMerge;

if (filespec.startsWith('https')) options.agent = new https.Agent({ keepAlive: true })
else if (filespec.startsWith('http')) options.agent = new http.Agent({ keepAlive: true });

function main(str,source,options){
    let input = yaml.parse(str,{schema:'core', merge:options.yamlMerge});
    resolver.resolve(input,source,options)
    .then(function(options){
        if (options.agent) {
            options.agent.destroy();
        }
        if(options.jsonOutput) {
            fs.writeFileSync(argv.output, JSON.stringify(options.openapi, null, 2),'utf8');
        }
        else {
            fs.writeFileSync(argv.output,yaml.stringify(options.openapi),'utf8');
        }
    })
    .catch(function(err){
        console.warn(err);
    });
}

if (filespec && filespec.startsWith('http')) {
    console.warn('GET ' + filespec);
    fetch(filespec, {agent:options.agent}).then(function (res) {
        if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
        return res.text();
    }).then(function (body) {
        main(body,filespec,options);
    }).catch(function (err) {
        console.warn(err);
    });
}
else {
    fs.readFile(filespec,'utf8',function(err,data){
        if (err) {
            console.warn(err);
        }
        else {
            main(data,filespec,options);
        }
    });
}
