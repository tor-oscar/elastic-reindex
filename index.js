#!/usr/bin/env node

const axios = require('axios'),
      yargs = require('yargs'),
      R = require('ramda');

function updateTemplate(uri, name, template) {
  return axios({
    method: 'POST',
    url: `${uri}/_template/${name}`,
    data: template,
    responseType: 'json',
  });
}

function getCurrentIndex(uri, name) {
  return axios({
    method: 'GET',
    url: `${uri}/${name}`,
    responseType: 'json',
  })
  .then(R.pipe(R.prop('data'), R.keys))
  .catch(res => res.response && res.response.status == 404
    ? []
    : Promise.reject(res)
  );
}

function createNewIndex(uri, name) {
  return axios({
    method: 'PUT',
    url: `${uri}/${name}`,
    data: '',
  })
  .then(() => [name]);
}

function reindex(uri, newIndex, oldIndex) {
  return axios({
    method: 'POST',
    url: `${uri}/_reindex?refresh=true`,
    data: {
      source: { index: oldIndex },
      dest: { index: newIndex }
    }
  })
  .then(() => [newIndex, oldIndex]);
}

function updateAlias(uri, alias, newIndex, oldIndex) {
  return axios({
    method: 'POST',
    url: `${uri}/_aliases`,
    data: { actions: !oldIndex
      ? [ { add: { index: newIndex, alias } } ]
      : [ { add: { index: newIndex, alias } }, { remove: { index: oldIndex, alias } } ]
    }
  });
}

const yargv = yargs
  .scriptName('elastic-reindex')
  .usage('$0 <cmd> [args]')
  .option('uri', {
    type: 'string',
    description: 'Uri to elasticsearch'
  })
  .option('name', {
    type: 'string',
    alias: 'n',
    description: 'Name of alias and index template'
  })
  .option('template', {
    type: 'string',
    alias: 't',
    description: 'Path to index template'
  })
  .demandOption(['uri', 'name', 'template'], 'Please provide mandatory options')
  .help()
  .argv;

const templatePath = yargv.template;
const uri = yargv.uri;
const name = yargv.name;

const template = require(templatePath);

updateTemplate(uri, name, template)
.then(() => getCurrentIndex(uri, name))
.then(currentIndices => R.length(currentIndices) > 1
  ? Promise.reject('Multiple current indices')
  : R.head(currentIndices)
)
.then(currentIndex => createNewIndex(uri, `${name}-${Date.now()}`)
  .then(currentIndex ? ([newIndex]) => reindex(uri, newIndex, currentIndex) : R.identity)
)
.then(([newIndex, oldIndex]) => updateAlias(uri, name, newIndex, oldIndex))
.catch(err => {
  console.error(err);
  process.exit(1);
});
