/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const logger = require('@accordproject/cicero-core').logger;
const Template = require('@accordproject/cicero-core').Template;
const Clause = require('@accordproject/cicero-core').Clause;
const Engine = require('@accordproject/cicero-engine').Engine;
const CodeGen = require('composer-common').CodeGen;
const FileWriter = CodeGen.FileWriter;
const fs = require('fs');
const path = require('path');
const GoLangVisitor = CodeGen.GoLangVisitor;
const JavaVisitor = CodeGen.JavaVisitor;
const JSONSchemaVisitor = CodeGen.JSONSchemaVisitor;
const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
const TypescriptVisitor = CodeGen.TypescriptVisitor;

/**
 * Utility class that implements the commands exposed by the Cicero CLI.
 * @class
 * @memberof module:composer-cli
 */
class Commands {

    /**
     * Parse a sample text using a template
     *
     * @param {string} templatePath to the template directory
     * @param {string} samplePath to the sample file
     * @returns {object} Promise to the result of parsing
     */
    static parse(templatePath, samplePath) {
        let clause;
        const sampleText = fs.readFileSync(samplePath, 'utf8');

        return Template.fromDirectory(templatePath)
            .then((template) => {
                clause = new Clause(template);
                clause.parse(sampleText);
                return clause.getData();
            })
            .catch((err) => {
                logger.error(err);
            });
    }

    /**
     * Set default params before we parse a sample text using a template
     *
     * @param {object} argv the inbound argument values object
     * @returns {object} a modfied argument object
     */
    static validateParseArgs(argv) {
        // the user typed 'cicero parse dir'
        if(argv._.length === 2){
            argv.template = argv._[1];
        }

        if(!argv.template){
            logger.info('Using current directory as template folder');
            argv.template = '.';
        }

        argv.template = path.resolve(argv.template);

        const packageJsonExists = fs.existsSync(path.resolve(argv.template,'package.json'));
        let isCiceroTemplate = false;
        if(packageJsonExists){
            const packageJsonContents = JSON.parse(fs.readFileSync(path.resolve(argv.template,'package.json')),'utf8');
            isCiceroTemplate = packageJsonContents.engines && packageJsonContents.engines.cicero;
        }

        if(!argv.sample){
            logger.info('Loading a default sample.txt file.');
            argv.sample = path.resolve(argv.template,'sample.txt');
        }

        if (argv.verbose) {
            logger.info(`parse sample ${argv.sample} using a template ${argv.template}`);
        }

        let sampleExists = fs.existsSync(argv.sample);
        if(!packageJsonExists || !isCiceroTemplate){
            throw new Error(`${argv.template} is not a valid cicero template. Make sure that package.json exists and that it has a engines.cicero entry.`);
        } else if (!sampleExists){
            throw new Error('A sample text file is required. Try the --sample flag or create a sample.txt in the root folder of your template.');
        } else {
            return argv;
        }
    }

    /**
     * Execute a sample text using a template
     *
     * @param {string} templatePath to the template directory
     * @param {string} samplePath to the sample file
     * @param {string} requestPath to the request file
     * @param {string} statePath to the state file
     * @param {boolean} forceJs forces JavaScript logic
     * @returns {object} Promise to the result of parsing
     */
    static execute(templatePath, samplePath, requestPath, statePath, forceJs) {
        let clause;
        const sampleText = fs.readFileSync(samplePath, 'utf8');
        const requestJson = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
        const stateJson = JSON.parse(fs.readFileSync(statePath, 'utf8'));

        return Template.fromDirectory(templatePath)
            .then((template) => {
                clause = new Clause(template);
                clause.parse(sampleText);
                const engine = new Engine();
                return engine.execute(clause, requestJson, stateJson, forceJs);
            })
            .catch((err) => {
                logger.error(err);
            });
    }

    /**
     * Set default params before we execute a template
     *
     * @param {object} argv the inbound argument values object
     * @returns {object} a modfied argument object
     */
    static validateExecuteArgs(argv) {
        // the user typed 'cicero parse dir'
        if(argv._.length === 2){
            argv.template = argv._[1];
        }

        if(!argv.template){
            logger.info('Using current directory as template folder');
            argv.template = '.';
        }

        argv.template = path.resolve(argv.template);

        const packageJsonExists = fs.existsSync(path.resolve(argv.template,'package.json'));
        let isCiceroTemplate = false;
        if(packageJsonExists){
            const packageJsonContents = JSON.parse(fs.readFileSync(path.resolve(argv.template,'package.json')),'utf8');
            isCiceroTemplate = packageJsonContents.engines && packageJsonContents.engines.cicero;
        }


        if(!argv.sample){
            logger.info('Loading a default sample.txt file.');
            argv.sample = path.resolve(argv.template,'sample.txt');
        }

        if(!argv.request){
            logger.info('Loading a default request.json file.');
            argv.request = path.resolve(argv.template,'request.json');
        }

        if(!argv.state){
            logger.info('Loading a default state.json file.');
            argv.state = path.resolve(argv.template,'state.json');
        }

        if (argv.verbose) {
            logger.info(`execute sample ${argv.sample} using a template ${argv.template} with request ${argv.request} with state ${argv.state}`);
        }

        let sampleExists = fs.existsSync(argv.sample);
        let requestExists = fs.existsSync(argv.request);
        let stateExists = fs.existsSync(argv.state);
        if(!packageJsonExists || !isCiceroTemplate){
            throw new Error(`${argv.template} is not a valid cicero template. Make sure that package.json exists and that it has a engines.cicero entry.`);
        } else if (!sampleExists){
            throw new Error('A sample text file is required. Try the --sample flag or create a sample.txt in the root folder of your template.');
        } else if(!requestExists){
            throw new Error('A request file is required. Try the --request flag or create a request.json in the root folder of your template.');
        } else if (!stateExists){
            throw new Error('A state file file is required. Try the --state flag or create a state.txt in the root folder of your template.');
        } else {
            return argv;
        }
    }

    /**
     * Converts the model for a template into code
     *
     * @param {string} format the format to generate
     * @param {string} templatePath to the template directory
     * @param {string} outputDirectory the output directory
     * @returns {object} Promise to the result of code generation
     */
    static generate(format, templatePath, outputDirectory) {

        return Template.fromDirectory(templatePath)
            .then((template) => {

                let visitor = null;

                switch(format) {
                case 'Go':
                    visitor = new GoLangVisitor();
                    break;
                case 'PlantUML':
                    visitor = new PlantUMLVisitor();
                    break;
                case 'Typescript':
                    visitor = new TypescriptVisitor();
                    break;
                case 'Java':
                    visitor = new JavaVisitor();
                    break;
                case 'JSONSchema':
                    visitor = new JSONSchemaVisitor();
                    break;
                default:
                    throw new Error ('Unrecognized code generator: ' + format );
                }

                let parameters = {};
                parameters.fileWriter = new FileWriter(outputDirectory);
                template.getModelManager().accept(visitor, parameters);
            })
            .catch((err) => {
                logger.error(err);
            });
    }
}

module.exports = Commands;