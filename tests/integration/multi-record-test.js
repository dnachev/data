import {createStore} from 'dummy/tests/helpers/store';
import Ember from 'ember';

import {module, test} from 'qunit';

import DS from 'ember-data';

const { get, run, addObserver } = Ember;

let Person, CompactPerson, initialPayload, updatePayload, store;

function overrideType(payload, type, subType) {
  let newPayload = Ember.copy(payload, true);
  newPayload.data.type = type;
  if (subType) {
    newPayload.data.subTypes = [subType];
  }
  return newPayload;
}

module("integration/multi-record", {
  beforeEach() {
    initialPayload = {
      data: {
        type: 'person',
        id: '1',
        attributes: {
          name: 'Tom Dale',
          description: 'JavaScript thinkfluencer'
        }
      }
    };

    updatePayload = {
      data: {
        type: 'person',
        id: '1',
        attributes: {
          name: 'Yehuda Katz',
          description: 'Tilde Co-Founder, OSS enthusiast and world traveler.'
        }
      }
    };

    Person = DS.Model.extend({
      name: DS.attr('string'),
      description: DS.attr('string')
    });
    CompactPerson = DS.Model.extend({
      name: DS.attr('string')
    });

    store = createStore({
      person: Person,
      compactPerson: CompactPerson
    });
  },

  afterEach() {
    run(store, 'destroy');
    Person = CompactPerson = initialPayload = updatePayload = null;
  }
});

test("Records data will be correctly merged", function(assert) {
  run(() => {
    return store.push(overrideType(initialPayload, 'compact-person'));
  });

  let compactPerson = store.peekRecord('compact-person', '1');

  assert.strictEqual(compactPerson.constructor, CompactPerson);
  assert.equal(compactPerson.id, '1');
  assert.equal(get(compactPerson, 'name'), 'Tom Dale');
  assert.equal(get(compactPerson, 'description'), null);

  let person = store.peekRecord('person', '1');
  // Assert the `person` projection was nut pushed as well
  assert.notOk(person);

  run(() => {
    // trigger an update to the record
    store.push(updatePayload);
  });

  let newCompactPerson = store.peekRecord('compact-person', '1');
  assert.strictEqual(newCompactPerson, compactPerson);

  // the compact person should have been updated
  assert.equal(get(compactPerson, 'name'), 'Yehuda Katz');
  assert.equal(get(compactPerson, 'description'), null);

  // the `person` projection should be available as well now
  person = store.peekRecord('person', '1');

  assert.strictEqual(person.constructor, Person);
  assert.equal(person.id, '1');
  assert.equal(get(person, 'name'), 'Yehuda Katz');
  assert.equal(get(person, 'description'), 'Tilde Co-Founder, OSS enthusiast and world traveler.');

  // Ensure that pushing person doesn't automatically push compact-person
  run(() => {
    let payload = overrideType(initialPayload, 'person');
    // override the ID to simulate new record
    payload.data.id = '2';
    store.push(payload);
  });

  assert.ok(store.peekRecord('person', '2'));
  assert.notOk(store.peekRecord('compact-person', '2'));
});

test("updating a model will notify all materialized records", function(assert) {
  run(() => {
    return store.push(overrideType(initialPayload, 'compact-person'));
  });

  let compactPerson = store.peekRecord('compact-person', '1');
  let compactPersonNotified = false;

  addObserver(compactPerson, 'description', () => {
    compactPersonNotified = true;
  });

  run(() => {
    // trigger an update to the record
    store.push(overrideType(updatePayload, 'person'));
  });

  // the compact person should have been notified of changes
  assert.ok(compactPersonNotified, 'Expected compact person record to have been notified');
});

test('can push two projections of the record within the same payload', function(assert) {
  run(() => {
    return store.push(overrideType(initialPayload, 'person', 'compact-person'));
  });

  let compactPerson = store.peekRecord('compact-person', '1');
  let person = store.peekRecord('person', '1');

  assert.ok(compactPerson);
  assert.ok(person);
});


test('all records transition to new state', function(assert) {
  run(() => {
    return store.push(overrideType(initialPayload, 'person', 'compact-person'));
  });

  let compactPerson = store.peekRecord('compact-person', '1');
  let person = store.peekRecord('person', '1');

  run(() => {
    person.deleteRecord();
  });

  // deleting the person record should also mark the compactPerson for deletion as well
  assert.equal(get(compactPerson, 'isDeleted'), true);
});

test('record arrays can handle different records', function(assert) {
  run(() => {
    return store.push(overrideType(initialPayload, 'person', 'compact-person'));
  });

  let allPersons = store.peekAll('person');
  let allCompactPersons = store.peekAll('compact-person');

  assert.equal(get(allPersons, 'length'), 1);
  assert.equal(get(allCompactPersons, 'length'), 1);

  assert.strictEqual(allPersons.objectAt(0).constructor, Person);
  assert.strictEqual(allCompactPersons.objectAt(0).constructor, CompactPerson);
});
