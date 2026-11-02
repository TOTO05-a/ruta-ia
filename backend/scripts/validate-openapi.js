const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const specPath = path.resolve(__dirname, '../../docs/api/openapi.yaml');
const spec = yaml.load(fs.readFileSync(specPath, 'utf8'), { filename: specPath });
const errors = [];
let operations = 0;
let references = 0;
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

function walk(value, location = '#') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${location}/${index}`));
    return;
  }
  if (typeof value.$ref === 'string') {
    references += 1;
    if (!value.$ref.startsWith('#/')) {
      errors.push(`${location}: only local JSON Pointer $refs are allowed (${value.$ref})`);
    } else {
      const target = value.$ref.slice(2).split('/').map((part) =>
        decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~'));
      const resolved = target.reduce((current, key) => current?.[key], spec);
      if (resolved === undefined) errors.push(`${location}: unresolved $ref ${value.$ref}`);
    }
  }
  for (const [key, child] of Object.entries(value)) walk(child, `${location}/${key}`);
}

if (!spec || spec.openapi !== '3.1.0') errors.push('openapi must be 3.1.0');
if (!spec?.info?.title || !spec?.info?.version) errors.push('info.title and info.version are required');
if (!Array.isArray(spec?.servers) || spec.servers.length === 0) errors.push('at least one server is required');
if (!spec?.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
  errors.push('paths must contain at least one path');
}

for (const [route, pathItem] of Object.entries(spec?.paths || {})) {
  if (!route.startsWith('/')) errors.push(`path ${route}: must start with /`);
  for (const [method, operation] of Object.entries(pathItem || {})) {
    if (!methods.has(method)) continue;
    operations += 1;
    if (!operation || typeof operation !== 'object') {
      errors.push(`${method.toUpperCase()} ${route}: operation must be an object`);
      continue;
    }
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      errors.push(`${method.toUpperCase()} ${route}: responses are required`);
    }
    for (const [status, response] of Object.entries(operation.responses || {})) {
      if (!response?.$ref && typeof response?.description !== 'string') {
        errors.push(`${method.toUpperCase()} ${route} response ${status}: description is required`);
      }
    }
    for (const parameter of operation.parameters || []) {
      if (parameter.in === 'path' && parameter.required !== true) {
        errors.push(`${method.toUpperCase()} ${route}: path parameter ${parameter.name} must be required`);
      }
    }
  }
}

walk(spec);

if (errors.length) {
  console.error(`OpenAPI validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`OpenAPI structural validation passed: ${Object.keys(spec.paths).length} paths, ${operations} operations, ${references} resolved local references.`);
}
