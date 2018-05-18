# breadfruit

[![NPM](https://nodei.co/npm/breadfruit.png?compact=true)](https://nodei.co/npm/breadfruit/)

Not really bread. Not really fruit. Just like this package.  Some simple helpers on top of knex.

## create an instance of breadfruit

```javascript
const config = {
  client: 'postgresql',
  connection: 'postgres://postgres@localhost:5432/someDatabase',
  pool: { min: 1, max: 7 }
};

const bread = require('breadfruit')(config);
```

## Browse, Read, Edit, Add, Delete, Raw

```javascript
const {browse, read, edit, add, del, raw} = require('breadfruit')(config);

//get an array of users, by table, columns, and a filter
const users = await browse('users', ['username', 'user_id'], {active: true});


//get a single user by table, columns, and a filter
const user = await read('users', ['username', 'first_name'], {user_id: 1337});


//edit a user by table, returned columns, updated values, and a filter
const updatedUser = await edit('users', ['username', 'first_name'], {first_name: 'Howard'}, {user_id: 1337});


//add a new user by table, returned columns, and user data
const newUser = await add('users', ['user_id'], {first_name: 'Howard', username: 'howitzer'});


//delete a user by table and a filter
const deleteCount = await del('users', {user_id: 1337});


//perform a raw query
const rows = await raw('select * from users');

```
