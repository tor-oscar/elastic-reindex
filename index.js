#!/usr/bin/env node

const axios = require('axios'),
      yargs = require('yargs'),
      R = require('ramda');

function updateTemplate(client, name, template) {
  return client({
    method: 'POST',
    url: `_template/${name}`,
    data: template,
    responseType: 'json',
  });
}

function getCurrentIndex(client, name) {
  return client({
    method: 'GET',
    url: `${name}`,
    responseType: 'json',
  })
  .then(R.pipe(R.prop('data'), R.keys))
  .catch(res => res.response && res.response.status == 404
    ? []
    : Promise.reject(res)
  );
}

function createNewIndex(client, name) {
  return client({
    method: 'PUT',
    url: `${name}`,
    data: '',
  })
  .then(() => [name]);
}

function reindex(client, newIndex, oldIndex) {
  return client({
    method: 'POST',
    url: `_reindex?refresh=true`,
    data: {
      source: { index: oldIndex },
      dest: { index: newIndex }
    }
  })
  .then(() => [newIndex, oldIndex]);
}

function updateAlias(client, alias, newIndex, oldIndex) {
  return client({
    method: 'POST',
    url: `_aliases`,
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
  .option('api-key', {
    type: 'string',
    description: 'API key if required'
  })
  .demandOption(['uri', 'name', 'template'], 'Please provide mandatory options')
  .help()
  .argv;

const client = axios.create({
  baseURL: yargv.uri,
  headers: yargv['api-key'] ? { 'Authorization': `APIKey ${yargv['api-key']}` } : {},
});
const templatePath = yargv.template;
const name = yargv.name;

const template = require(templatePath);

updateTemplate(client, name, template)
.then(() => getCurrentIndex(client, name))
.then(currentIndices => R.length(currentIndices) > 1
  ? Promise.reject('Multiple current indices')
  : R.head(currentIndices)
)
.then(currentIndex => createNewIndex(client, `${name}-${Date.now()}`)
  .then(currentIndex ? ([newIndex]) => reindex(client, newIndex, currentIndex) : R.identity)
)
.then(([newIndex, oldIndex]) => updateAlias(client, name, newIndex, oldIndex))
.catch(err => {
  if (err.response && err.response.data) {
    console.error(`${err.config.method} ${err.config.url} -> ${err.response.status}\n${JSON.stringify(err.response.data)}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
