# elastic-reindex
CLI tool to reindex an opinionated elastic search setup

## TODO

 * Should not run reindexing if the template is unchanged.
 * Improve error handling, inspecting http response objects are a bit crude.
 * Parse the name from the template `index_patterns` property.

## Assumptions and opinions on setup

The index mappings and settings are contained in a template.
This template is stored in elastic search with the name `$NAME`.
It must contain `"index_patterns": [ "$NAME-*" ]`.
An alias `$NAME` points to the last created index.
The indices are named `$NAME-$EPOCH`.

## Usage

The script will first update or create the template.
If the alias exists, the script will create a new index, run a reindexing job from the aliased index to the new index
and move the alias to the new index.
If the alias does not exist a new index and an alias will be created.

```
$ elastic-reindex --uri http://localhost:9200 --name mydata --template /path/to/my/template.json
```
