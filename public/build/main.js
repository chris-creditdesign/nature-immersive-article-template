
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function validate_store(store, name) {
    if (store != null && typeof store.subscribe !== 'function') {
        throw new Error(`'${name}' is not a store with a 'subscribe' method`);
    }
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function null_to_empty(value) {
    return value == null ? '' : value;
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached
    const children = target.childNodes;
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
            target.actual_end_child = target.firstChild;
        }
        if (node !== target.actual_end_child) {
            target.insertBefore(node, target.actual_end_child);
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target) {
        target.appendChild(node);
    }
}
function insert(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append(target, node);
    }
    else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                processNode(node);
                nodes.splice(i, 1);
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                processNode(node);
                nodes.splice(i, 1);
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element(nodes, name, attributes, svg) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
    }, () => svg ? svg_element(name) : element(name));
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        node.data = '' + data;
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}
function query_selector_all(selector, parent = document.body) {
    return Array.from(parent.querySelectorAll(selector));
}

const active_docs = new Set();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = node.ownerDocument;
    active_docs.add(doc);
    const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
    const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
    if (!current_rules[name]) {
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        active_docs.forEach(doc => {
            const stylesheet = doc.__svelte_stylesheet;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            doc.__svelte_rules = {};
        });
        active_docs.clear();
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
// TODO figure out if we still want to support
// shorthand events, or if we want to implement
// a real bubbling mechanism
function bubble(component, event) {
    const callbacks = component.$$.callbacks[event.type];
    if (callbacks) {
        // @ts-ignore
        callbacks.slice().forEach(fn => fn.call(this, event));
    }
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_out_transition(node, fn, params) {
    let config = fn(node, params);
    let running = true;
    let animation_name;
    const group = outros;
    group.r += 1;
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        add_render_callback(() => dispatch(node, false, 'start'));
        loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(0, 1);
                    dispatch(node, false, 'end');
                    if (!--group.r) {
                        // this will result in `end()` being called,
                        // so we don't need to clean up here
                        run_all(group.c);
                    }
                    return false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(1 - t, t);
                }
            }
            return running;
        });
    }
    if (is_function(config)) {
        wait().then(() => {
            // @ts-ignore
            config = config();
            go();
        });
    }
    else {
        go();
    }
    return {
        end(reset) {
            if (reset && config.tick) {
                config.tick(1, 0);
            }
            if (running) {
                if (animation_name)
                    delete_rule(node, animation_name);
                running = false;
            }
        }
    };
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global);

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component(block) {
    block && block.c();
}
function claim_component(block, parent_nodes) {
    block && block.l(parent_nodes);
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init$1(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : options.context || []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.wholeText === data)
        return;
    dispatch_dev('SvelteDOMSetData', { node: text, data });
    text.data = data;
}
function validate_each_argument(arg) {
    if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
        let msg = '{#each} only iterates over array-like objects.';
        if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
            msg += ' You can use a spread to convert this iterable into an array.';
        }
        throw new Error(msg);
    }
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
/**
 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
 */
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error("'target' is a required option");
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn('Component was already destroyed'); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

/* node_modules/creditdesign-svelte-components/src/components/Box/index.svelte generated by Svelte v3.38.3 */

const file$k = "node_modules/creditdesign-svelte-components/src/components/Box/index.svelte";

function create_fragment$k(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", { class: true, style: true });
			var div_nodes = children(div);
			if (default_slot) default_slot.l(div_nodes);
			div_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(div, "class", "box svelte-dzdna");
			attr_dev(div, "style", /*boxSpaceComponent*/ ctx[0]);
			add_location(div, file$k, 22, 0, 404);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], !current ? -1 : dirty, null, null);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$k.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$k($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Box", slots, ['default']);
	let { boxSpace = "" } = $$props;

	let boxSpaceComponent = boxSpace.length
	? `--box-space--component: ${boxSpace};`
	: "";

	const writable_props = ["boxSpace"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Box> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("boxSpace" in $$props) $$invalidate(1, boxSpace = $$props.boxSpace);
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ boxSpace, boxSpaceComponent });

	$$self.$inject_state = $$props => {
		if ("boxSpace" in $$props) $$invalidate(1, boxSpace = $$props.boxSpace);
		if ("boxSpaceComponent" in $$props) $$invalidate(0, boxSpaceComponent = $$props.boxSpaceComponent);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [boxSpaceComponent, boxSpace, $$scope, slots];
}

class Box extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$k, create_fragment$k, safe_not_equal, { boxSpace: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Box",
			options,
			id: create_fragment$k.name
		});
	}

	get boxSpace() {
		throw new Error("<Box>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set boxSpace(value) {
		throw new Error("<Box>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/creditdesign-svelte-components/src/components/Center/index.svelte generated by Svelte v3.38.3 */

const file$j = "node_modules/creditdesign-svelte-components/src/components/Center/index.svelte";

function create_fragment$j(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	const block = {
		c: function create() {
			div = element("div");
			if (default_slot) default_slot.c();
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", { class: true, style: true });
			var div_nodes = children(div);
			if (default_slot) default_slot.l(div_nodes);
			div_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(div, "class", "center svelte-l22bbz");
			attr_dev(div, "style", /*style*/ ctx[0]);
			add_location(div, file$j, 43, 0, 1084);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], !current ? -1 : dirty, null, null);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$j.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$j($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Center", slots, ['default']);
	let { centerMeasure = "" } = $$props;
	let { centerSpace = "" } = $$props;

	let centerMeasureComponent = centerMeasure.length
	? `--center-measure--component: ${centerMeasure};`
	: "";

	let centerSpaceComponent = centerSpace.length
	? `--center-space--component: ${centerSpace};`
	: "";

	let style = `${centerMeasureComponent} ${centerSpaceComponent}`;
	const writable_props = ["centerMeasure", "centerSpace"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Center> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("centerMeasure" in $$props) $$invalidate(1, centerMeasure = $$props.centerMeasure);
		if ("centerSpace" in $$props) $$invalidate(2, centerSpace = $$props.centerSpace);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		centerMeasure,
		centerSpace,
		centerMeasureComponent,
		centerSpaceComponent,
		style
	});

	$$self.$inject_state = $$props => {
		if ("centerMeasure" in $$props) $$invalidate(1, centerMeasure = $$props.centerMeasure);
		if ("centerSpace" in $$props) $$invalidate(2, centerSpace = $$props.centerSpace);
		if ("centerMeasureComponent" in $$props) centerMeasureComponent = $$props.centerMeasureComponent;
		if ("centerSpaceComponent" in $$props) centerSpaceComponent = $$props.centerSpaceComponent;
		if ("style" in $$props) $$invalidate(0, style = $$props.style);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [style, centerMeasure, centerSpace, $$scope, slots];
}

class Center extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$j, create_fragment$j, safe_not_equal, { centerMeasure: 1, centerSpace: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Center",
			options,
			id: create_fragment$j.name
		});
	}

	get centerMeasure() {
		throw new Error("<Center>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set centerMeasure(value) {
		throw new Error("<Center>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get centerSpace() {
		throw new Error("<Center>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set centerSpace(value) {
		throw new Error("<Center>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/creditdesign-svelte-components/src/components/ClusterList/index.svelte generated by Svelte v3.38.3 */

const file$i = "node_modules/creditdesign-svelte-components/src/components/ClusterList/index.svelte";

function create_fragment$i(ctx) {
	let div;
	let ul;
	let current;
	const default_slot_template = /*#slots*/ ctx[4].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

	const block = {
		c: function create() {
			div = element("div");
			ul = element("ul");
			if (default_slot) default_slot.c();
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", { class: true, style: true });
			var div_nodes = children(div);
			ul = claim_element(div_nodes, "UL", { class: true });
			var ul_nodes = children(ul);
			if (default_slot) default_slot.l(ul_nodes);
			ul_nodes.forEach(detach_dev);
			div_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(ul, "class", "cluster--list__inner svelte-1dbwytq");
			add_location(ul, file$i, 68, 2, 1587);
			attr_dev(div, "class", "cluster--list svelte-1dbwytq");
			attr_dev(div, "style", /*style*/ ctx[0]);
			add_location(div, file$i, 67, 0, 1541);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, ul);

			if (default_slot) {
				default_slot.m(ul, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], !current ? -1 : dirty, null, null);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$i.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$i($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("ClusterList", slots, ['default']);
	let { clusterJustifyContent = "" } = $$props;
	let { clusterSpace = "" } = $$props;

	let clusterJustifyContentComponent = clusterJustifyContent.length
	? `--cluster-justify-content--component: ${clusterJustifyContent};`
	: "";

	let clusterSpaceComponent = clusterSpace.length
	? `--cluster-space--component: ${clusterSpace};`
	: "";

	let style = `${clusterJustifyContentComponent} ${clusterSpaceComponent}`;
	const writable_props = ["clusterJustifyContent", "clusterSpace"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ClusterList> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("clusterJustifyContent" in $$props) $$invalidate(1, clusterJustifyContent = $$props.clusterJustifyContent);
		if ("clusterSpace" in $$props) $$invalidate(2, clusterSpace = $$props.clusterSpace);
		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		clusterJustifyContent,
		clusterSpace,
		clusterJustifyContentComponent,
		clusterSpaceComponent,
		style
	});

	$$self.$inject_state = $$props => {
		if ("clusterJustifyContent" in $$props) $$invalidate(1, clusterJustifyContent = $$props.clusterJustifyContent);
		if ("clusterSpace" in $$props) $$invalidate(2, clusterSpace = $$props.clusterSpace);
		if ("clusterJustifyContentComponent" in $$props) clusterJustifyContentComponent = $$props.clusterJustifyContentComponent;
		if ("clusterSpaceComponent" in $$props) clusterSpaceComponent = $$props.clusterSpaceComponent;
		if ("style" in $$props) $$invalidate(0, style = $$props.style);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [style, clusterJustifyContent, clusterSpace, $$scope, slots];
}

class ClusterList extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init$1(this, options, instance$i, create_fragment$i, safe_not_equal, {
			clusterJustifyContent: 1,
			clusterSpace: 2
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "ClusterList",
			options,
			id: create_fragment$i.name
		});
	}

	get clusterJustifyContent() {
		throw new Error("<ClusterList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set clusterJustifyContent(value) {
		throw new Error("<ClusterList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get clusterSpace() {
		throw new Error("<ClusterList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set clusterSpace(value) {
		throw new Error("<ClusterList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/creditdesign-svelte-components/src/components/Stack/index.svelte generated by Svelte v3.38.3 */

const file$h = "node_modules/creditdesign-svelte-components/src/components/Stack/index.svelte";

function create_fragment$h(ctx) {
	let div1;
	let div0;
	let current;
	const default_slot_template = /*#slots*/ ctx[3].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

	const block = {
		c: function create() {
			div1 = element("div");
			div0 = element("div");
			if (default_slot) default_slot.c();
			this.h();
		},
		l: function claim(nodes) {
			div1 = claim_element(nodes, "DIV", {});
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
			var div0_nodes = children(div0);
			if (default_slot) default_slot.l(div0_nodes);
			div0_nodes.forEach(detach_dev);
			div1_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(div0, "class", "stack svelte-tewrqr");
			attr_dev(div0, "style", /*stackSpaceComponent*/ ctx[0]);
			add_location(div0, file$h, 41, 2, 719);
			add_location(div1, file$h, 40, 0, 711);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div1, anchor);
			append_dev(div1, div0);

			if (default_slot) {
				default_slot.m(div0, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], !current ? -1 : dirty, null, null);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div1);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$h.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$h($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Stack", slots, ['default']);
	let { stackSpace = "" } = $$props;

	let stackSpaceComponent = stackSpace.length
	? `--stack-space--component: ${stackSpace};`
	: "";

	const writable_props = ["stackSpace"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stack> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("stackSpace" in $$props) $$invalidate(1, stackSpace = $$props.stackSpace);
		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ stackSpace, stackSpaceComponent });

	$$self.$inject_state = $$props => {
		if ("stackSpace" in $$props) $$invalidate(1, stackSpace = $$props.stackSpace);
		if ("stackSpaceComponent" in $$props) $$invalidate(0, stackSpaceComponent = $$props.stackSpaceComponent);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [stackSpaceComponent, stackSpace, $$scope, slots];
}

class Stack extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$h, create_fragment$h, safe_not_equal, { stackSpace: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Stack",
			options,
			id: create_fragment$h.name
		});
	}

	get stackSpace() {
		throw new Error("<Stack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set stackSpace(value) {
		throw new Error("<Stack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/**
 * Given a valid unix time stamp return a date string
 * if format is "day-month-year" return formatted as "22 March 2020"
 * if format is "iso-string" return as a a valid global date and time string
 * i.e. 2022-03-29T07:59:29.000Z
 *
 * @param {*} unixTimeStamp
 * @param {*} format
 * @returns
 */
const formatDate = (unixTimeStamp, format = "day-month-year") => {
  const date = new Date(parseInt(unixTimeStamp, 10) * 1000);
  const year = date.getFullYear();
  const month = date.toLocaleDateString("en", { month: "long" });
  const day = date.getDate();

  if (format === "iso-string") {
    return date.toISOString();
  }

  return `${day} ${month} ${year}`;
};

/* node_modules/nature-immersive-svelte-components/src/components/Heading/index.svelte generated by Svelte v3.38.3 */
const file$g = "node_modules/nature-immersive-svelte-components/src/components/Heading/index.svelte";

// (60:6) <Stack stackSpace={headStandStackSpace}>
function create_default_slot_3(ctx) {
	let h1;
	let t;
	let p;

	const block = {
		c: function create() {
			h1 = element("h1");
			t = space();
			p = element("p");
			this.h();
		},
		l: function claim(nodes) {
			h1 = claim_element(nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			h1_nodes.forEach(detach_dev);
			t = claim_space(nodes);
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			p_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(h1, "class", "letter-spacing:tight svelte-19qhu5i");
			add_location(h1, file$g, 60, 8, 1278);
			attr_dev(p, "class", "stand-first svelte-19qhu5i");
			add_location(p, file$g, 63, 8, 1361);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h1, anchor);
			h1.innerHTML = /*headline*/ ctx[7];
			insert_dev(target, t, anchor);
			insert_dev(target, p, anchor);
			p.innerHTML = /*stand*/ ctx[10];
		},
		p: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(h1);
			if (detaching) detach_dev(t);
			if (detaching) detach_dev(p);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_3.name,
		type: "slot",
		source: "(60:6) <Stack stackSpace={headStandStackSpace}>",
		ctx
	});

	return block;
}

// (69:6) {#if author || photographer || publishedAt}
function create_if_block$5(ctx) {
	let stack;
	let current;

	stack = new Stack({
			props: {
				stackSpace: /*creditsStackSpace*/ ctx[5],
				$$slots: { default: [create_default_slot_2$2] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(stack.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(stack.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(stack, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};
			if (dirty & /*creditsStackSpace*/ 32) stack_changes.stackSpace = /*creditsStackSpace*/ ctx[5];

			if (dirty & /*$$scope*/ 4096) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(stack, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$5.name,
		type: "if",
		source: "(69:6) {#if author || photographer || publishedAt}",
		ctx
	});

	return block;
}

// (71:10) {#if author}
function create_if_block_3$1(ctx) {
	let p;

	const block = {
		c: function create() {
			p = element("p");
			this.h();
		},
		l: function claim(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			p_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(p, "class", "author font-weight:bold svelte-19qhu5i");
			add_location(p, file$g, 71, 12, 1570);
		},
		m: function mount(target, anchor) {
			insert_dev(target, p, anchor);
			p.innerHTML = /*author*/ ctx[6];
		},
		p: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(p);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_3$1.name,
		type: "if",
		source: "(71:10) {#if author}",
		ctx
	});

	return block;
}

// (76:10) {#if photographer}
function create_if_block_2$1(ctx) {
	let p;

	const block = {
		c: function create() {
			p = element("p");
			this.h();
		},
		l: function claim(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			p_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(p, "class", "photographer font-weight:bold svelte-19qhu5i");
			add_location(p, file$g, 76, 12, 1709);
		},
		m: function mount(target, anchor) {
			insert_dev(target, p, anchor);
			p.innerHTML = /*photographer*/ ctx[8];
		},
		p: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(p);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_2$1.name,
		type: "if",
		source: "(76:10) {#if photographer}",
		ctx
	});

	return block;
}

// (82:10) {#if publishedAt}
function create_if_block_1$1(ctx) {
	let time;
	let t_value = formatDate(/*publishedAt*/ ctx[9], "day-month-year") + "";
	let t;

	const block = {
		c: function create() {
			time = element("time");
			t = text(t_value);
			this.h();
		},
		l: function claim(nodes) {
			time = claim_element(nodes, "TIME", {
				class: true,
				itemprop: true,
				datetime: true
			});

			var time_nodes = children(time);
			t = claim_text(time_nodes, t_value);
			time_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(time, "class", "font-family:sans-serif font-size:small\n              text-transform:uppercase svelte-19qhu5i");
			attr_dev(time, "itemprop", "datePublished");
			attr_dev(time, "datetime", formatDate(/*publishedAt*/ ctx[9], "iso-string"));
			add_location(time, file$g, 82, 12, 1860);
		},
		m: function mount(target, anchor) {
			insert_dev(target, time, anchor);
			append_dev(time, t);
		},
		p: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(time);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1$1.name,
		type: "if",
		source: "(82:10) {#if publishedAt}",
		ctx
	});

	return block;
}

// (70:8) <Stack stackSpace={creditsStackSpace}>
function create_default_slot_2$2(ctx) {
	let t0;
	let t1;
	let if_block2_anchor;
	let if_block0 = /*author*/ ctx[6] && create_if_block_3$1(ctx);
	let if_block1 = /*photographer*/ ctx[8] && create_if_block_2$1(ctx);
	let if_block2 = /*publishedAt*/ ctx[9] && create_if_block_1$1(ctx);

	const block = {
		c: function create() {
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			if_block2_anchor = empty();
		},
		l: function claim(nodes) {
			if (if_block0) if_block0.l(nodes);
			t0 = claim_space(nodes);
			if (if_block1) if_block1.l(nodes);
			t1 = claim_space(nodes);
			if (if_block2) if_block2.l(nodes);
			if_block2_anchor = empty();
		},
		m: function mount(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert_dev(target, t0, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert_dev(target, t1, anchor);
			if (if_block2) if_block2.m(target, anchor);
			insert_dev(target, if_block2_anchor, anchor);
		},
		p: function update(ctx, dirty) {
			if (/*author*/ ctx[6]) if_block0.p(ctx, dirty);
			if (/*photographer*/ ctx[8]) if_block1.p(ctx, dirty);
			if (/*publishedAt*/ ctx[9]) if_block2.p(ctx, dirty);
		},
		d: function destroy(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach_dev(t0);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach_dev(t1);
			if (if_block2) if_block2.d(detaching);
			if (detaching) detach_dev(if_block2_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_2$2.name,
		type: "slot",
		source: "(70:8) <Stack stackSpace={creditsStackSpace}>",
		ctx
	});

	return block;
}

// (59:4) <Stack stackSpace={headAndCreditsStackSpace}>
function create_default_slot_1$2(ctx) {
	let stack;
	let t;
	let if_block_anchor;
	let current;

	stack = new Stack({
			props: {
				stackSpace: /*headStandStackSpace*/ ctx[4],
				$$slots: { default: [create_default_slot_3] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	let if_block = (/*author*/ ctx[6] || /*photographer*/ ctx[8] || /*publishedAt*/ ctx[9]) && create_if_block$5(ctx);

	const block = {
		c: function create() {
			create_component(stack.$$.fragment);
			t = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			claim_component(stack.$$.fragment, nodes);
			t = claim_space(nodes);
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			mount_component(stack, target, anchor);
			insert_dev(target, t, anchor);
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};
			if (dirty & /*headStandStackSpace*/ 16) stack_changes.stackSpace = /*headStandStackSpace*/ ctx[4];

			if (dirty & /*$$scope*/ 4096) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
			if (/*author*/ ctx[6] || /*photographer*/ ctx[8] || /*publishedAt*/ ctx[9]) if_block.p(ctx, dirty);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(stack, detaching);
			if (detaching) detach_dev(t);
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_1$2.name,
		type: "slot",
		source: "(59:4) <Stack stackSpace={headAndCreditsStackSpace}>",
		ctx
	});

	return block;
}

// (58:2) <Center centerMeasure={maxWidth} {centerSpace}>
function create_default_slot$4(ctx) {
	let stack;
	let current;

	stack = new Stack({
			props: {
				stackSpace: /*headAndCreditsStackSpace*/ ctx[3],
				$$slots: { default: [create_default_slot_1$2] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(stack.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(stack.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(stack, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};
			if (dirty & /*headAndCreditsStackSpace*/ 8) stack_changes.stackSpace = /*headAndCreditsStackSpace*/ ctx[3];

			if (dirty & /*$$scope, creditsStackSpace, headStandStackSpace*/ 4144) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(stack, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot$4.name,
		type: "slot",
		source: "(58:2) <Center centerMeasure={maxWidth} {centerSpace}>",
		ctx
	});

	return block;
}

function create_fragment$g(ctx) {
	let div;
	let center;
	let div_class_value;
	let current;

	center = new Center({
			props: {
				centerMeasure: /*maxWidth*/ ctx[1],
				centerSpace: /*centerSpace*/ ctx[2],
				$$slots: { default: [create_default_slot$4] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			div = element("div");
			create_component(center.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			claim_component(center.$$.fragment, div_nodes);
			div_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(div, "class", div_class_value = "" + (null_to_empty(`heading ${/*className*/ ctx[0]}`) + " svelte-19qhu5i"));
			add_location(div, file$g, 56, 0, 1086);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			mount_component(center, div, null);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const center_changes = {};
			if (dirty & /*maxWidth*/ 2) center_changes.centerMeasure = /*maxWidth*/ ctx[1];
			if (dirty & /*centerSpace*/ 4) center_changes.centerSpace = /*centerSpace*/ ctx[2];

			if (dirty & /*$$scope, headAndCreditsStackSpace, creditsStackSpace, headStandStackSpace*/ 4152) {
				center_changes.$$scope = { dirty, ctx };
			}

			center.$set(center_changes);

			if (!current || dirty & /*className*/ 1 && div_class_value !== (div_class_value = "" + (null_to_empty(`heading ${/*className*/ ctx[0]}`) + " svelte-19qhu5i"))) {
				attr_dev(div, "class", div_class_value);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(center.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(center.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			destroy_component(center);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$g.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$g($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Heading", slots, []);
	let { articleData } = $$props;
	let { className = "" } = $$props;
	let { maxWidth = "var(--measure-big)" } = $$props;
	let { centerSpace = "0" } = $$props;
	let { headAndCreditsStackSpace = "var(--s2)" } = $$props;
	let { headStandStackSpace = "var(--s2)" } = $$props;
	let { creditsStackSpace = "var(--s-3)" } = $$props;
	let { author, headline, photographer, publishedAt, stand } = articleData;

	const writable_props = [
		"articleData",
		"className",
		"maxWidth",
		"centerSpace",
		"headAndCreditsStackSpace",
		"headStandStackSpace",
		"creditsStackSpace"
	];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Heading> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("articleData" in $$props) $$invalidate(11, articleData = $$props.articleData);
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("maxWidth" in $$props) $$invalidate(1, maxWidth = $$props.maxWidth);
		if ("centerSpace" in $$props) $$invalidate(2, centerSpace = $$props.centerSpace);
		if ("headAndCreditsStackSpace" in $$props) $$invalidate(3, headAndCreditsStackSpace = $$props.headAndCreditsStackSpace);
		if ("headStandStackSpace" in $$props) $$invalidate(4, headStandStackSpace = $$props.headStandStackSpace);
		if ("creditsStackSpace" in $$props) $$invalidate(5, creditsStackSpace = $$props.creditsStackSpace);
	};

	$$self.$capture_state = () => ({
		Center,
		Stack,
		formatDate,
		articleData,
		className,
		maxWidth,
		centerSpace,
		headAndCreditsStackSpace,
		headStandStackSpace,
		creditsStackSpace,
		author,
		headline,
		photographer,
		publishedAt,
		stand
	});

	$$self.$inject_state = $$props => {
		if ("articleData" in $$props) $$invalidate(11, articleData = $$props.articleData);
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("maxWidth" in $$props) $$invalidate(1, maxWidth = $$props.maxWidth);
		if ("centerSpace" in $$props) $$invalidate(2, centerSpace = $$props.centerSpace);
		if ("headAndCreditsStackSpace" in $$props) $$invalidate(3, headAndCreditsStackSpace = $$props.headAndCreditsStackSpace);
		if ("headStandStackSpace" in $$props) $$invalidate(4, headStandStackSpace = $$props.headStandStackSpace);
		if ("creditsStackSpace" in $$props) $$invalidate(5, creditsStackSpace = $$props.creditsStackSpace);
		if ("author" in $$props) $$invalidate(6, author = $$props.author);
		if ("headline" in $$props) $$invalidate(7, headline = $$props.headline);
		if ("photographer" in $$props) $$invalidate(8, photographer = $$props.photographer);
		if ("publishedAt" in $$props) $$invalidate(9, publishedAt = $$props.publishedAt);
		if ("stand" in $$props) $$invalidate(10, stand = $$props.stand);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		className,
		maxWidth,
		centerSpace,
		headAndCreditsStackSpace,
		headStandStackSpace,
		creditsStackSpace,
		author,
		headline,
		photographer,
		publishedAt,
		stand,
		articleData
	];
}

class Heading extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init$1(this, options, instance$g, create_fragment$g, safe_not_equal, {
			articleData: 11,
			className: 0,
			maxWidth: 1,
			centerSpace: 2,
			headAndCreditsStackSpace: 3,
			headStandStackSpace: 4,
			creditsStackSpace: 5
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Heading",
			options,
			id: create_fragment$g.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*articleData*/ ctx[11] === undefined && !("articleData" in props)) {
			console.warn("<Heading> was created without expected prop 'articleData'");
		}
	}

	get articleData() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set articleData(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get className() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get maxWidth() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set maxWidth(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get centerSpace() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set centerSpace(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get headAndCreditsStackSpace() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set headAndCreditsStackSpace(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get headStandStackSpace() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set headStandStackSpace(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get creditsStackSpace() {
		throw new Error("<Heading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set creditsStackSpace(value) {
		throw new Error("<Heading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/Head/index.svelte generated by Svelte v3.38.3 */

const file$f = "node_modules/nature-immersive-svelte-components/src/components/Head/index.svelte";

function create_fragment$f(ctx) {
	let meta0;
	let meta1;
	let title_value;
	let meta2;
	let meta3;
	let meta4;
	let meta5;
	let meta6;
	let meta7;
	let meta8;
	let meta9;
	let meta10;
	let meta11;
	let meta12;
	let link0;
	let link1;
	let link2;
	document.title = title_value = /*title*/ ctx[4];

	const block = {
		c: function create() {
			meta0 = element("meta");
			meta1 = element("meta");
			meta2 = element("meta");
			meta3 = element("meta");
			meta4 = element("meta");
			meta5 = element("meta");
			meta6 = element("meta");
			meta7 = element("meta");
			meta8 = element("meta");
			meta9 = element("meta");
			meta10 = element("meta");
			meta11 = element("meta");
			meta12 = element("meta");
			link0 = element("link");
			link1 = element("link");
			link2 = element("link");
			this.h();
		},
		l: function claim(nodes) {
			const head_nodes = query_selector_all("[data-svelte=\"svelte-y71mfy\"]", document.head);
			meta0 = claim_element(head_nodes, "META", { charset: true });
			meta1 = claim_element(head_nodes, "META", { name: true, content: true });
			meta2 = claim_element(head_nodes, "META", { name: true, content: true });
			meta3 = claim_element(head_nodes, "META", { property: true, content: true });
			meta4 = claim_element(head_nodes, "META", { property: true, content: true });
			meta5 = claim_element(head_nodes, "META", { property: true, content: true });
			meta6 = claim_element(head_nodes, "META", { property: true, content: true });
			meta7 = claim_element(head_nodes, "META", { property: true, content: true });
			meta8 = claim_element(head_nodes, "META", { name: true, content: true });
			meta9 = claim_element(head_nodes, "META", { name: true, content: true });
			meta10 = claim_element(head_nodes, "META", { name: true, content: true });
			meta11 = claim_element(head_nodes, "META", { name: true, content: true });
			meta12 = claim_element(head_nodes, "META", { name: true, content: true });
			link0 = claim_element(head_nodes, "LINK", { rel: true, sizes: true, href: true });

			link1 = claim_element(head_nodes, "LINK", {
				rel: true,
				type: true,
				sizes: true,
				href: true
			});

			link2 = claim_element(head_nodes, "LINK", {
				rel: true,
				type: true,
				sizes: true,
				href: true
			});

			head_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(meta0, "charset", "UTF-8");
			add_location(meta0, file$f, 16, 2, 237);
			attr_dev(meta1, "name", "viewport");
			attr_dev(meta1, "content", "width=device-width, initial-scale=1.0, shrink-to-fit=no");
			add_location(meta1, file$f, 17, 2, 264);
			attr_dev(meta2, "name", "description");
			attr_dev(meta2, "content", /*description*/ ctx[2]);
			add_location(meta2, file$f, 24, 2, 394);
			attr_dev(meta3, "property", "og:url");
			attr_dev(meta3, "content", `${/*articleURL*/ ctx[1]}${/*doi*/ ctx[3]}`);
			add_location(meta3, file$f, 25, 2, 448);
			attr_dev(meta4, "property", "og:type");
			attr_dev(meta4, "content", "article");
			add_location(meta4, file$f, 27, 2, 512);
			attr_dev(meta5, "property", "og:title");
			attr_dev(meta5, "content", /*title*/ ctx[4]);
			add_location(meta5, file$f, 28, 2, 560);
			attr_dev(meta6, "property", "og:description");
			attr_dev(meta6, "content", /*description*/ ctx[2]);
			add_location(meta6, file$f, 29, 2, 609);
			attr_dev(meta7, "property", "og:image");
			attr_dev(meta7, "content", /*imageURL*/ ctx[0]);
			add_location(meta7, file$f, 30, 2, 670);
			attr_dev(meta8, "name", "twitter:card");
			attr_dev(meta8, "content", "summary_large_image");
			add_location(meta8, file$f, 32, 2, 723);
			attr_dev(meta9, "name", "twitter:site");
			attr_dev(meta9, "content", /*twitterHandle*/ ctx[5]);
			add_location(meta9, file$f, 33, 2, 784);
			attr_dev(meta10, "name", "twitter:title");
			attr_dev(meta10, "content", /*title*/ ctx[4]);
			add_location(meta10, file$f, 34, 2, 841);
			attr_dev(meta11, "name", "twitter:description");
			attr_dev(meta11, "content", /*description*/ ctx[2]);
			add_location(meta11, file$f, 35, 2, 891);
			attr_dev(meta12, "name", "twitter:image");
			attr_dev(meta12, "content", /*imageURL*/ ctx[0]);
			add_location(meta12, file$f, 36, 2, 953);
			attr_dev(link0, "rel", "apple-touch-icon");
			attr_dev(link0, "sizes", "180x180");
			attr_dev(link0, "href", "img/apple-touch-icon.png");
			add_location(link0, file$f, 38, 2, 1007);
			attr_dev(link1, "rel", "icon");
			attr_dev(link1, "type", "image/png");
			attr_dev(link1, "sizes", "32x32");
			attr_dev(link1, "href", "img/favicon-32x32.png");
			add_location(link1, file$f, 43, 2, 1103);
			attr_dev(link2, "rel", "icon");
			attr_dev(link2, "type", "image/png");
			attr_dev(link2, "sizes", "16x16");
			attr_dev(link2, "href", "img/favicon-16x16.png");
			add_location(link2, file$f, 49, 2, 1203);
		},
		m: function mount(target, anchor) {
			append_dev(document.head, meta0);
			append_dev(document.head, meta1);
			append_dev(document.head, meta2);
			append_dev(document.head, meta3);
			append_dev(document.head, meta4);
			append_dev(document.head, meta5);
			append_dev(document.head, meta6);
			append_dev(document.head, meta7);
			append_dev(document.head, meta8);
			append_dev(document.head, meta9);
			append_dev(document.head, meta10);
			append_dev(document.head, meta11);
			append_dev(document.head, meta12);
			append_dev(document.head, link0);
			append_dev(document.head, link1);
			append_dev(document.head, link2);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*title*/ 16 && title_value !== (title_value = /*title*/ ctx[4])) {
				document.title = title_value;
			}

			if (dirty & /*imageURL*/ 1) {
				attr_dev(meta7, "content", /*imageURL*/ ctx[0]);
			}

			if (dirty & /*imageURL*/ 1) {
				attr_dev(meta12, "content", /*imageURL*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			detach_dev(meta0);
			detach_dev(meta1);
			detach_dev(meta2);
			detach_dev(meta3);
			detach_dev(meta4);
			detach_dev(meta5);
			detach_dev(meta6);
			detach_dev(meta7);
			detach_dev(meta8);
			detach_dev(meta9);
			detach_dev(meta10);
			detach_dev(meta11);
			detach_dev(meta12);
			detach_dev(link0);
			detach_dev(link1);
			detach_dev(link2);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$f.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$f($$self, $$props, $$invalidate) {
	let imageURL;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Head", slots, []);
	let { articleData } = $$props;
	let { articleURL, description, doi, immersiveURL, title, twitterHandle } = articleData;
	const writable_props = ["articleData"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Head> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("articleData" in $$props) $$invalidate(6, articleData = $$props.articleData);
	};

	$$self.$capture_state = () => ({
		articleData,
		articleURL,
		description,
		doi,
		immersiveURL,
		title,
		twitterHandle,
		imageURL
	});

	$$self.$inject_state = $$props => {
		if ("articleData" in $$props) $$invalidate(6, articleData = $$props.articleData);
		if ("articleURL" in $$props) $$invalidate(1, articleURL = $$props.articleURL);
		if ("description" in $$props) $$invalidate(2, description = $$props.description);
		if ("doi" in $$props) $$invalidate(3, doi = $$props.doi);
		if ("immersiveURL" in $$props) $$invalidate(7, immersiveURL = $$props.immersiveURL);
		if ("title" in $$props) $$invalidate(4, title = $$props.title);
		if ("twitterHandle" in $$props) $$invalidate(5, twitterHandle = $$props.twitterHandle);
		if ("imageURL" in $$props) $$invalidate(0, imageURL = $$props.imageURL);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$invalidate(0, imageURL = `${immersiveURL}${doi}/img/${doi}.jpg`);
	return [imageURL, articleURL, description, doi, title, twitterHandle, articleData];
}

class Head extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$f, create_fragment$f, safe_not_equal, { articleData: 6 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Head",
			options,
			id: create_fragment$f.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*articleData*/ ctx[6] === undefined && !("articleData" in props)) {
			console.warn("<Head> was created without expected prop 'articleData'");
		}
	}

	get articleData() {
		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set articleData(value) {
		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoSpringerNature/index.svelte generated by Svelte v3.38.3 */

const file$e = "node_modules/nature-immersive-svelte-components/src/components/LogoSpringerNature/index.svelte";

function create_fragment$e(ctx) {
	let svg;
	let path;
	let svg_class_value;
	let svg_height_value;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[2]);
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, /*title*/ ctx[2]);
			span_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path, "d", "M74.9,5.7c0-2.8-2.4-3.8-4.6-3.8c-1.1,0-2.8,0-3.8,0v11.6h2.9V10h0.9c0.2,0,0.3,0,0.5,0l0,0l0,0c0.5,0.8,1.1,2,1.3,3.5\n    c0.6,0,1.1,0,1.5,0h0.8c0.3,0,0.5,0,0.8,0c-0.3-1.8-1.2-3.5-1.8-4.4l0,0l0,0C74.3,8.2,74.9,7.1,74.9,5.7z\n    M71.8,6.1\n    c0,1.2-0.5,1.7-1.6,1.7c-0.4,0-0.6,0-0.8,0l0,0V4.1l0,0c0.3,0,0.6,0,0.9,0C71.6,4.1,71.8,4.9,71.8,6.1z\n    M64.3,13.5v-2.3h-4.1V8.7\n    h3.7V6.5h-3.7V4.2h4.1V1.9h-6.8v9.5c0,0,0,0.9,0.6,1.5c0.4,0.4,0.9,0.6,1.6,0.6C61.7,13.6,64,13.5,64.3,13.5z\n    M51.4,13.9\n    c1.1,0,2.8-0.3,4.1-0.9V7.2h-3.8v2h1.2v2.4l0,0c-0.3,0.1-1,0.2-1.3,0.2c-1.5,0-2.1-1.1-2.1-4c0-2.5,0.9-3.8,2.7-3.8\n    c0.6,0,1.5,0.3,2.4,0.7l0.8-1.9c-1.1-0.7-2.4-1-3.6-1c-1.7,0-3,0.5-3.8,1.5c-0.8,1-1.2,2.5-1.2,4.5C46.6,12.2,47.9,13.9,51.4,13.9z\n    M41.7,13.5h3V1.9h-2.5v7.6l-3.4-7.6h-3.1v11.6h2.5V6.2L41.7,13.5L41.7,13.5z\n    M30.2,13.5h2.9V2h-2.9V13.5z M26.6,9.1L26.6,9.1\n    L26.6,9.1c1-0.8,1.5-2,1.5-3.4c0-2.8-2.4-3.8-4.6-3.8c-1.1,0-2.8,0-3.8,0v11.6h2.9V10h0.9c0.2,0,0.3,0,0.5,0l0,0l0,0\n    c0.5,0.8,1.1,2,1.3,3.5c0.6,0,1.1,0,1.5,0h0.8c0.3,0,0.5,0,0.8,0C28.1,11.7,27.2,10,26.6,9.1z\n    M25,6.1c0,1.2-0.5,1.7-1.6,1.7\n    c-0.4,0-0.6,0-0.8,0l0,0V4.1l0,0c0.3,0,0.6,0,0.9,0C24.8,4.1,25,4.9,25,6.1z\n    M18.2,5.6c0-2.4-1.5-3.7-4.3-3.7c-1.1,0-2.8,0-3.8,0\n    v11.6H13V10h0.9C15.2,10,18.2,9.6,18.2,5.6z\n    M15.5,6.1c0,1.2-0.5,1.7-1.6,1.7c-0.4,0-0.6,0-0.8,0l0,0V4.1l0,0c0.3,0,0.6,0,0.9,0\n    C15.2,4.1,15.5,4.9,15.5,6.1z\n    M3.3,4.1c0-0.6,0.4-1.3,1.4-1.3c0.7,0,1.5,0.2,2.5,0.7l1-2.1C7,0.8,5.8,0.4,4.5,0.4\n    c-2.6,0-4.2,1.4-4.2,3.8s1.8,3.3,3.3,4c1.1,0.5,2,1,2,1.8c0,0.7-0.7,1.2-1.6,1.2c-0.8,0-1.7-0.3-2.9-0.9l-1,2.2\n    c1.4,0.8,2.7,1.1,4.1,1.1c2.7,0,4.3-1.5,4.3-4c0-2.4-1.8-3.2-3.3-3.9C4.2,5.3,3.3,4.9,3.3,4.1L3.3,4.1z\n    M134.8,11.2V8.7h3.7V6.5\n    h-3.7V4.2h4.1V1.9h-6.8v9.5c0,0,0,0.9,0.6,1.5c0.4,0.4,0.9,0.6,1.6,0.6c2.1,0,4.4-0.1,4.7-0.1v-2.3H134.8L134.8,11.2z\n    M128.6,9.1\n    L128.6,9.1L128.6,9.1c1-0.8,1.5-2,1.5-3.4c0-2.8-2.4-3.8-4.6-3.8c-1.1,0-2.8,0-3.8,0v11.6h2.9V10h0.9c0.2,0,0.3,0,0.5,0l0,0l0,0\n    c0.5,0.8,1.1,2,1.3,3.5c0.6,0,1.1,0,1.5,0h0.8c0.3,0,0.5,0,0.8,0C130.1,11.7,129.2,10,128.6,9.1L128.6,9.1z\n    M127,6.1\n    c0,1.2-0.5,1.7-1.6,1.7c-0.4,0-0.6,0-0.8,0l0,0V4.1l0,0c0.3,0,0.6,0,0.9,0C126.8,4.1,127,4.9,127,6.1z\n    M119.5,9.4V1.9h-3v7.7\n    c0,1.2-0.1,1.9-1.4,1.9c-1.3,0-1.5-0.6-1.5-1.9V1.9h-3v7.8c0,2.8,1.3,4,4.3,4C118.1,13.8,119.5,12.4,119.5,9.4L119.5,9.4z\n    M106.8,4.3h2.2V1.9h-7.8v2.4h2.6v9.2h3C106.8,13.5,106.8,4.3,106.8,4.3z\n    M98,13.5h3.1L98.3,1.9h-4.5L91,13.5h2.9l0.4-1.8h3.2 L98,13.5L98,13.5z\n    M97.2,9.5h-2.5l1.2-5H96l0,0L97.2,9.5L97.2,9.5z\n    M85.9,13.5h3.4v-13h-2.8l0.1,9.1l-4.2-9.1h-3.4v13h2.7l0-9\n    l0.1,0.2L85.9,13.5L85.9,13.5z");
			add_location(path, file$e, 20, 2, 309);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 140 14");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$e, 13, 0, 187);
			attr_dev(span, "class", "visually-hidden");
			add_location(span, file$e, 59, 0, 3009);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path);
			insert_dev(target, t0, anchor);
			insert_dev(target, span, anchor);
			append_dev(span, t1);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}

			if (dirty & /*title*/ 4) set_data_dev(t1, /*title*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$e.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$e($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoSpringerNature", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	let { title = "Springer Nature" } = $$props;
	const writable_props = ["className", "height", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoSpringerNature> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	$$self.$capture_state = () => ({ className, height, title });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height, title];
}

class LogoSpringerNature extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$e, create_fragment$e, safe_not_equal, { className: 0, height: 1, title: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoSpringerNature",
			options,
			id: create_fragment$e.name
		});
	}

	get className() {
		throw new Error("<LogoSpringerNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoSpringerNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoSpringerNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoSpringerNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<LogoSpringerNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<LogoSpringerNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/Footer/index.svelte generated by Svelte v3.38.3 */
const file$d = "node_modules/nature-immersive-svelte-components/src/components/Footer/index.svelte";

// (26:6) <ClusterList>
function create_default_slot_2$1(ctx) {
	let li0;
	let a0;
	let t0;
	let t1;
	let li1;
	let a1;
	let t2;
	let t3;
	let li2;
	let a2;
	let t4;
	let t5;
	let li3;
	let a3;
	let t6;
	let t7;
	let li4;
	let a4;
	let t8;

	const block = {
		c: function create() {
			li0 = element("li");
			a0 = element("a");
			t0 = text("Privacy Policy");
			t1 = space();
			li1 = element("li");
			a1 = element("a");
			t2 = text("Use of cookies");
			t3 = space();
			li2 = element("li");
			a2 = element("a");
			t4 = text("Legal notice");
			t5 = space();
			li3 = element("li");
			a3 = element("a");
			t6 = text("Terms & Conditions");
			t7 = space();
			li4 = element("li");
			a4 = element("a");
			t8 = text("Accessibility statement");
			this.h();
		},
		l: function claim(nodes) {
			li0 = claim_element(nodes, "LI", {});
			var li0_nodes = children(li0);
			a0 = claim_element(li0_nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "Privacy Policy");
			a0_nodes.forEach(detach_dev);
			li0_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			li1 = claim_element(nodes, "LI", {});
			var li1_nodes = children(li1);
			a1 = claim_element(li1_nodes, "A", { href: true, class: true });
			var a1_nodes = children(a1);
			t2 = claim_text(a1_nodes, "Use of cookies");
			a1_nodes.forEach(detach_dev);
			li1_nodes.forEach(detach_dev);
			t3 = claim_space(nodes);
			li2 = claim_element(nodes, "LI", {});
			var li2_nodes = children(li2);
			a2 = claim_element(li2_nodes, "A", { href: true, class: true });
			var a2_nodes = children(a2);
			t4 = claim_text(a2_nodes, "Legal notice");
			a2_nodes.forEach(detach_dev);
			li2_nodes.forEach(detach_dev);
			t5 = claim_space(nodes);
			li3 = claim_element(nodes, "LI", {});
			var li3_nodes = children(li3);
			a3 = claim_element(li3_nodes, "A", { href: true, class: true });
			var a3_nodes = children(a3);
			t6 = claim_text(a3_nodes, "Terms & Conditions");
			a3_nodes.forEach(detach_dev);
			li3_nodes.forEach(detach_dev);
			t7 = claim_space(nodes);
			li4 = claim_element(nodes, "LI", {});
			var li4_nodes = children(li4);
			a4 = claim_element(li4_nodes, "A", { href: true, class: true });
			var a4_nodes = children(a4);
			t8 = claim_text(a4_nodes, "Accessibility statement");
			a4_nodes.forEach(detach_dev);
			li4_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a0, "href", "https://www.nature.com/info/privacy.html");
			attr_dev(a0, "class", "svelte-55fbus");
			add_location(a0, file$d, 27, 10, 523);
			add_location(li0, file$d, 26, 8, 508);
			attr_dev(a1, "href", "https://www.nature.com/info/cookies.html");
			attr_dev(a1, "class", "svelte-55fbus");
			add_location(a1, file$d, 30, 10, 630);
			add_location(li1, file$d, 29, 8, 615);
			attr_dev(a2, "href", "https://www.nature.com/info/legal_notice.html");
			attr_dev(a2, "class", "svelte-55fbus");
			add_location(a2, file$d, 33, 10, 737);
			add_location(li2, file$d, 32, 8, 722);
			attr_dev(a3, "href", "https://www.nature.com/info/tandc.html");
			attr_dev(a3, "class", "svelte-55fbus");
			add_location(a3, file$d, 38, 10, 871);
			add_location(li3, file$d, 37, 8, 856);
			attr_dev(a4, "href", "https://www.nature.com/info/accessibility_statement.html");
			attr_dev(a4, "class", "svelte-55fbus");
			add_location(a4, file$d, 43, 10, 1004);
			add_location(li4, file$d, 42, 8, 989);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li0, anchor);
			append_dev(li0, a0);
			append_dev(a0, t0);
			insert_dev(target, t1, anchor);
			insert_dev(target, li1, anchor);
			append_dev(li1, a1);
			append_dev(a1, t2);
			insert_dev(target, t3, anchor);
			insert_dev(target, li2, anchor);
			append_dev(li2, a2);
			append_dev(a2, t4);
			insert_dev(target, t5, anchor);
			insert_dev(target, li3, anchor);
			append_dev(li3, a3);
			append_dev(a3, t6);
			insert_dev(target, t7, anchor);
			insert_dev(target, li4, anchor);
			append_dev(li4, a4);
			append_dev(a4, t8);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li0);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(li1);
			if (detaching) detach_dev(t3);
			if (detaching) detach_dev(li2);
			if (detaching) detach_dev(t5);
			if (detaching) detach_dev(li3);
			if (detaching) detach_dev(t7);
			if (detaching) detach_dev(li4);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_2$1.name,
		type: "slot",
		source: "(26:6) <ClusterList>",
		ctx
	});

	return block;
}

// (21:4) <Stack stackSpace="var(--s-1)">
function create_default_slot_1$1(ctx) {
	let div;
	let logospringernature;
	let t0;
	let clusterlist;
	let t1;
	let small;
	let t2;
	let current;
	logospringernature = new LogoSpringerNature({ props: { height: 1.5 }, $$inline: true });

	clusterlist = new ClusterList({
			props: {
				$$slots: { default: [create_default_slot_2$1] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			div = element("div");
			create_component(logospringernature.$$.fragment);
			t0 = space();
			create_component(clusterlist.$$.fragment);
			t1 = space();
			small = element("small");
			t2 = text("© 2021 Springer Nature Limited. All rights reserved.");
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", {});
			var div_nodes = children(div);
			claim_component(logospringernature.$$.fragment, div_nodes);
			div_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			claim_component(clusterlist.$$.fragment, nodes);
			t1 = claim_space(nodes);
			small = claim_element(nodes, "SMALL", {});
			var small_nodes = children(small);
			t2 = claim_text(small_nodes, "© 2021 Springer Nature Limited. All rights reserved.");
			small_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			add_location(div, file$d, 21, 6, 416);
			add_location(small, file$d, 49, 6, 1165);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			mount_component(logospringernature, div, null);
			insert_dev(target, t0, anchor);
			mount_component(clusterlist, target, anchor);
			insert_dev(target, t1, anchor);
			insert_dev(target, small, anchor);
			append_dev(small, t2);
			current = true;
		},
		p: function update(ctx, dirty) {
			const clusterlist_changes = {};

			if (dirty & /*$$scope*/ 1) {
				clusterlist_changes.$$scope = { dirty, ctx };
			}

			clusterlist.$set(clusterlist_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(logospringernature.$$.fragment, local);
			transition_in(clusterlist.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(logospringernature.$$.fragment, local);
			transition_out(clusterlist.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			destroy_component(logospringernature);
			if (detaching) detach_dev(t0);
			destroy_component(clusterlist, detaching);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(small);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_1$1.name,
		type: "slot",
		source: "(21:4) <Stack stackSpace=\\\"var(--s-1)\\\">",
		ctx
	});

	return block;
}

// (20:2) <Box>
function create_default_slot$3(ctx) {
	let stack;
	let current;

	stack = new Stack({
			props: {
				stackSpace: "var(--s-1)",
				$$slots: { default: [create_default_slot_1$1] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(stack.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(stack.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(stack, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};

			if (dirty & /*$$scope*/ 1) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(stack, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot$3.name,
		type: "slot",
		source: "(20:2) <Box>",
		ctx
	});

	return block;
}

function create_fragment$d(ctx) {
	let footer;
	let box;
	let current;

	box = new Box({
			props: {
				$$slots: { default: [create_default_slot$3] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			footer = element("footer");
			create_component(box.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			footer = claim_element(nodes, "FOOTER", { class: true, "data-theme": true });
			var footer_nodes = children(footer);
			claim_component(box.$$.fragment, footer_nodes);
			footer_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(footer, "class", "footer font-size:small font-family:sans-serif svelte-55fbus");
			attr_dev(footer, "data-theme", "invert");
			add_location(footer, file$d, 15, 0, 278);
		},
		m: function mount(target, anchor) {
			insert_dev(target, footer, anchor);
			mount_component(box, footer, null);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const box_changes = {};

			if (dirty & /*$$scope*/ 1) {
				box_changes.$$scope = { dirty, ctx };
			}

			box.$set(box_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(box.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(box.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(footer);
			destroy_component(box);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$d.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$d($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Footer", slots, []);
	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
	});

	$$self.$capture_state = () => ({
		Box,
		Stack,
		ClusterList,
		LogoSpringerNature
	});

	return [];
}

class Footer extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$d, create_fragment$d, safe_not_equal, {});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Footer",
			options,
			id: create_fragment$d.name
		});
	}
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}
function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single
        ? [stores]
        : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
        let inited = false;
        const values = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set);
            if (auto) {
                set(result);
            }
            else {
                cleanup = is_function(result) ? result : noop;
            }
        };
        const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (inited) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        inited = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
        };
    });
}

/* eslint-disable consistent-return */

const menuElement = writable();

const menuHeight = derived(
  menuElement,
  ($menuElement, set) => {
    if (!$menuElement) return;

    const ro = new ResizeObserver(([entry]) => {
      let { offsetHeight } = entry.target;
      set(offsetHeight);
    });

    ro.observe($menuElement);

    return () => ro.disconnect();
  },
  0
);

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}
function quadIn(t) {
    return t * t;
}
function quadOut(t) {
    return -t * (t - 2.0);
}

function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
    const style = getComputedStyle(node);
    const opacity = +style.opacity;
    const height = parseFloat(style.height);
    const padding_top = parseFloat(style.paddingTop);
    const padding_bottom = parseFloat(style.paddingBottom);
    const margin_top = parseFloat(style.marginTop);
    const margin_bottom = parseFloat(style.marginBottom);
    const border_top_width = parseFloat(style.borderTopWidth);
    const border_bottom_width = parseFloat(style.borderBottomWidth);
    return {
        delay,
        duration,
        easing,
        css: t => 'overflow: hidden;' +
            `opacity: ${Math.min(t * 20, 1) * opacity};` +
            `height: ${t * height}px;` +
            `padding-top: ${t * padding_top}px;` +
            `padding-bottom: ${t * padding_bottom}px;` +
            `margin-top: ${t * margin_top}px;` +
            `margin-bottom: ${t * margin_bottom}px;` +
            `border-top-width: ${t * border_top_width}px;` +
            `border-bottom-width: ${t * border_bottom_width}px;`
    };
}

/* node_modules/nature-immersive-svelte-components/src/components/MenuList/index.svelte generated by Svelte v3.38.3 */
const file$c = "node_modules/nature-immersive-svelte-components/src/components/MenuList/index.svelte";

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i].text;
	child_ctx[10] = list[i].href;
	child_ctx[12] = i;
	return child_ctx;
}

// (89:8) {:else}
function create_else_block$2(ctx) {
	let li;
	let a;
	let raw_value = /*text*/ ctx[9] + "";
	let a_href_value;
	let a_data_event_label_value;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			li = element("li");
			a = element("a");
			t = space();
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);

			a = claim_element(li_nodes, "A", {
				href: true,
				"data-event-category": true,
				"data-event-action": true,
				"data-event-label": true,
				class: true
			});

			var a_nodes = children(a);
			a_nodes.forEach(detach_dev);
			t = claim_space(li_nodes);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a, "href", a_href_value = /*href*/ ctx[10]);
			attr_dev(a, "data-event-category", "menu");
			attr_dev(a, "data-event-action", "click");
			attr_dev(a, "data-event-label", a_data_event_label_value = /*text*/ ctx[9]);
			attr_dev(a, "class", "text-decoration:none");
			add_location(a, file$c, 90, 12, 2186);
			attr_dev(li, "class", "svelte-dztoe");
			toggle_class(li, "flex-basis:100", /*menuLinks*/ ctx[1].length > 8);
			add_location(li, file$c, 89, 10, 2125);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			append_dev(li, a);
			a.innerHTML = raw_value;
			/*a_binding*/ ctx[8](a);
			append_dev(li, t);

			if (!mounted) {
				dispose = [
					listen_dev(a, "focus", /*focus_handler_1*/ ctx[6], false, false, false),
					listen_dev(a, "blur", /*blur_handler_1*/ ctx[7], false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*menuLinks*/ 2 && raw_value !== (raw_value = /*text*/ ctx[9] + "")) a.innerHTML = raw_value;
			if (dirty & /*menuLinks*/ 2 && a_href_value !== (a_href_value = /*href*/ ctx[10])) {
				attr_dev(a, "href", a_href_value);
			}

			if (dirty & /*menuLinks*/ 2 && a_data_event_label_value !== (a_data_event_label_value = /*text*/ ctx[9])) {
				attr_dev(a, "data-event-label", a_data_event_label_value);
			}

			if (dirty & /*menuLinks*/ 2) {
				toggle_class(li, "flex-basis:100", /*menuLinks*/ ctx[1].length > 8);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
			/*a_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$2.name,
		type: "else",
		source: "(89:8) {:else}",
		ctx
	});

	return block;
}

// (75:8) {#if i !== menuLinks.length - 1}
function create_if_block$4(ctx) {
	let li;
	let a;
	let raw_value = /*text*/ ctx[9] + "";
	let a_href_value;
	let a_data_event_label_value;
	let t;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			li = element("li");
			a = element("a");
			t = space();
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);

			a = claim_element(li_nodes, "A", {
				href: true,
				"data-event-category": true,
				"data-event-action": true,
				"data-event-label": true,
				class: true
			});

			var a_nodes = children(a);
			a_nodes.forEach(detach_dev);
			t = claim_space(li_nodes);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a, "href", a_href_value = /*href*/ ctx[10]);
			attr_dev(a, "data-event-category", "menu");
			attr_dev(a, "data-event-action", "click");
			attr_dev(a, "data-event-label", a_data_event_label_value = /*text*/ ctx[9]);
			attr_dev(a, "class", "text-decoration:none");
			add_location(a, file$c, 76, 12, 1794);
			attr_dev(li, "class", "svelte-dztoe");
			toggle_class(li, "flex-basis:100", /*menuLinks*/ ctx[1].length > 8);
			add_location(li, file$c, 75, 10, 1733);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			append_dev(li, a);
			a.innerHTML = raw_value;
			append_dev(li, t);

			if (!mounted) {
				dispose = [
					listen_dev(a, "focus", /*focus_handler*/ ctx[4], false, false, false),
					listen_dev(a, "blur", /*blur_handler*/ ctx[5], false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*menuLinks*/ 2 && raw_value !== (raw_value = /*text*/ ctx[9] + "")) a.innerHTML = raw_value;
			if (dirty & /*menuLinks*/ 2 && a_href_value !== (a_href_value = /*href*/ ctx[10])) {
				attr_dev(a, "href", a_href_value);
			}

			if (dirty & /*menuLinks*/ 2 && a_data_event_label_value !== (a_data_event_label_value = /*text*/ ctx[9])) {
				attr_dev(a, "data-event-label", a_data_event_label_value);
			}

			if (dirty & /*menuLinks*/ 2) {
				toggle_class(li, "flex-basis:100", /*menuLinks*/ ctx[1].length > 8);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$4.name,
		type: "if",
		source: "(75:8) {#if i !== menuLinks.length - 1}",
		ctx
	});

	return block;
}

// (74:6) {#each menuLinks as { text, href }
function create_each_block$1(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*i*/ ctx[12] !== /*menuLinks*/ ctx[1].length - 1) return create_if_block$4;
		return create_else_block$2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			if_block.l(nodes);
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d: function destroy(detaching) {
			if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block$1.name,
		type: "each",
		source: "(74:6) {#each menuLinks as { text, href }",
		ctx
	});

	return block;
}

function create_fragment$c(ctx) {
	let nav;
	let div;
	let ul;
	let nav_intro;
	let nav_outro;
	let current;
	let each_value = /*menuLinks*/ ctx[1];
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const block = {
		c: function create() {
			nav = element("nav");
			div = element("div");
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l: function claim(nodes) {
			nav = claim_element(nodes, "NAV", {
				"data-theme": true,
				style: true,
				class: true
			});

			var nav_nodes = children(nav);
			div = claim_element(nav_nodes, "DIV", { class: true });
			var div_nodes = children(div);
			ul = claim_element(div_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach_dev);
			div_nodes.forEach(detach_dev);
			nav_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(ul, "class", "svelte-dztoe");
			add_location(ul, file$c, 72, 4, 1632);
			attr_dev(div, "class", "menu-switcher svelte-dztoe");
			add_location(div, file$c, 71, 2, 1600);
			attr_dev(nav, "data-theme", "menu");
			attr_dev(nav, "style", /*style*/ ctx[2]);
			attr_dev(nav, "class", "font-family:sans-serif svelte-dztoe");
			add_location(nav, file$c, 64, 0, 1432);
		},
		m: function mount(target, anchor) {
			insert_dev(target, nav, anchor);
			append_dev(nav, div);
			append_dev(div, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}

			current = true;
		},
		p: function update(new_ctx, [dirty]) {
			ctx = new_ctx;

			if (dirty & /*menuLinks, lastMenuLinkElem*/ 3) {
				each_value = /*menuLinks*/ ctx[1];
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: function intro(local) {
			if (current) return;

			add_render_callback(() => {
				if (nav_outro) nav_outro.end(1);
				if (!nav_intro) nav_intro = create_in_transition(nav, slide, { duration: 250, easing: quadOut });
				nav_intro.start();
			});

			current = true;
		},
		o: function outro(local) {
			if (nav_intro) nav_intro.invalidate();
			nav_outro = create_out_transition(nav, slide, { duration: 250, easing: quadIn });
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(nav);
			destroy_each(each_blocks, detaching);
			if (detaching && nav_outro) nav_outro.end();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$c.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$c($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("MenuList", slots, []);
	let { menuLinks = [] } = $$props;
	let { lastMenuLinkElem = null } = $$props;
	let { menuHeight = 0 } = $$props;
	let style = `top: ${menuHeight}px;`;
	const writable_props = ["menuLinks", "lastMenuLinkElem", "menuHeight"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuList> was created with unknown prop '${key}'`);
	});

	function focus_handler(event) {
		bubble.call(this, $$self, event);
	}

	function blur_handler(event) {
		bubble.call(this, $$self, event);
	}

	function focus_handler_1(event) {
		bubble.call(this, $$self, event);
	}

	function blur_handler_1(event) {
		bubble.call(this, $$self, event);
	}

	function a_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			lastMenuLinkElem = $$value;
			$$invalidate(0, lastMenuLinkElem);
		});
	}

	$$self.$$set = $$props => {
		if ("menuLinks" in $$props) $$invalidate(1, menuLinks = $$props.menuLinks);
		if ("lastMenuLinkElem" in $$props) $$invalidate(0, lastMenuLinkElem = $$props.lastMenuLinkElem);
		if ("menuHeight" in $$props) $$invalidate(3, menuHeight = $$props.menuHeight);
	};

	$$self.$capture_state = () => ({
		slide,
		quadIn,
		quadOut,
		menuLinks,
		lastMenuLinkElem,
		menuHeight,
		style
	});

	$$self.$inject_state = $$props => {
		if ("menuLinks" in $$props) $$invalidate(1, menuLinks = $$props.menuLinks);
		if ("lastMenuLinkElem" in $$props) $$invalidate(0, lastMenuLinkElem = $$props.lastMenuLinkElem);
		if ("menuHeight" in $$props) $$invalidate(3, menuHeight = $$props.menuHeight);
		if ("style" in $$props) $$invalidate(2, style = $$props.style);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		lastMenuLinkElem,
		menuLinks,
		style,
		menuHeight,
		focus_handler,
		blur_handler,
		focus_handler_1,
		blur_handler_1,
		a_binding
	];
}

class MenuList extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init$1(this, options, instance$c, create_fragment$c, safe_not_equal, {
			menuLinks: 1,
			lastMenuLinkElem: 0,
			menuHeight: 3
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "MenuList",
			options,
			id: create_fragment$c.name
		});
	}

	get menuLinks() {
		throw new Error("<MenuList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set menuLinks(value) {
		throw new Error("<MenuList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get lastMenuLinkElem() {
		throw new Error("<MenuList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set lastMenuLinkElem(value) {
		throw new Error("<MenuList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get menuHeight() {
		throw new Error("<MenuList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set menuHeight(value) {
		throw new Error("<MenuList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/MenuListStatic/index.svelte generated by Svelte v3.38.3 */
const file$b = "node_modules/nature-immersive-svelte-components/src/components/MenuListStatic/index.svelte";

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i].text;
	child_ctx[2] = list[i].href;
	child_ctx[4] = i;
	return child_ctx;
}

// (16:0) {#if menuLinks && menuLinks.length}
function create_if_block$3(ctx) {
	let nav;
	let stack;
	let current;

	stack = new Stack({
			props: {
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			nav = element("nav");
			create_component(stack.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			nav = claim_element(nodes, "NAV", { "data-theme": true, class: true });
			var nav_nodes = children(nav);
			claim_component(stack.$$.fragment, nav_nodes);
			nav_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(nav, "data-theme", "menu");
			attr_dev(nav, "class", "font-family:sans-serif svelte-1fnr10s");
			add_location(nav, file$b, 16, 2, 247);
		},
		m: function mount(target, anchor) {
			insert_dev(target, nav, anchor);
			mount_component(stack, nav, null);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};

			if (dirty & /*$$scope, menuLinks*/ 33) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(nav);
			destroy_component(stack);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$3.name,
		type: "if",
		source: "(16:0) {#if menuLinks && menuLinks.length}",
		ctx
	});

	return block;
}

// (21:8) {#each menuLinks as { text, href }
function create_each_block(ctx) {
	let li;
	let a;
	let raw_value = /*text*/ ctx[1] + "";
	let a_href_value;
	let t;

	const block = {
		c: function create() {
			li = element("li");
			a = element("a");
			t = space();
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", {});
			var li_nodes = children(li);
			a = claim_element(li_nodes, "A", { class: true, href: true });
			var a_nodes = children(a);
			a_nodes.forEach(detach_dev);
			t = claim_space(li_nodes);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a, "class", "text-decoration:none");
			attr_dev(a, "href", a_href_value = /*href*/ ctx[2]);
			add_location(a, file$b, 22, 12, 466);
			add_location(li, file$b, 21, 10, 449);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			append_dev(li, a);
			a.innerHTML = raw_value;
			append_dev(li, t);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*menuLinks*/ 1 && raw_value !== (raw_value = /*text*/ ctx[1] + "")) a.innerHTML = raw_value;
			if (dirty & /*menuLinks*/ 1 && a_href_value !== (a_href_value = /*href*/ ctx[2])) {
				attr_dev(a, "href", a_href_value);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block.name,
		type: "each",
		source: "(21:8) {#each menuLinks as { text, href }",
		ctx
	});

	return block;
}

// (18:4) <Stack>
function create_default_slot$2(ctx) {
	let h2;
	let t0;
	let t1;
	let ul;
	let each_value = /*menuLinks*/ ctx[0];
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const block = {
		c: function create() {
			h2 = element("h2");
			t0 = text("Menu");
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l: function claim(nodes) {
			h2 = claim_element(nodes, "H2", { id: true, class: true, tabindex: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, "Menu");
			h2_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			ul = claim_element(nodes, "UL", {});
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(h2, "id", "menu");
			attr_dev(h2, "class", "font-size:base");
			attr_dev(h2, "tabindex", "-1");
			add_location(h2, file$b, 18, 6, 320);
			add_location(ul, file$b, 19, 6, 387);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h2, anchor);
			append_dev(h2, t0);
			insert_dev(target, t1, anchor);
			insert_dev(target, ul, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*menuLinks*/ 1) {
				each_value = /*menuLinks*/ ctx[0];
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h2);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(ul);
			destroy_each(each_blocks, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot$2.name,
		type: "slot",
		source: "(18:4) <Stack>",
		ctx
	});

	return block;
}

function create_fragment$b(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*menuLinks*/ ctx[0] && /*menuLinks*/ ctx[0].length && create_if_block$3(ctx);

	const block = {
		c: function create() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (/*menuLinks*/ ctx[0] && /*menuLinks*/ ctx[0].length) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*menuLinks*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$3(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$b.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$b($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("MenuListStatic", slots, []);
	let { menuLinks } = $$props;
	const writable_props = ["menuLinks"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuListStatic> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("menuLinks" in $$props) $$invalidate(0, menuLinks = $$props.menuLinks);
	};

	$$self.$capture_state = () => ({ Stack, menuLinks });

	$$self.$inject_state = $$props => {
		if ("menuLinks" in $$props) $$invalidate(0, menuLinks = $$props.menuLinks);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [menuLinks];
}

class MenuListStatic extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$b, create_fragment$b, safe_not_equal, { menuLinks: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "MenuListStatic",
			options,
			id: create_fragment$b.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*menuLinks*/ ctx[0] === undefined && !("menuLinks" in props)) {
			console.warn("<MenuListStatic> was created without expected prop 'menuLinks'");
		}
	}

	get menuLinks() {
		throw new Error("<MenuListStatic>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set menuLinks(value) {
		throw new Error("<MenuListStatic>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoFacebook/index.svelte generated by Svelte v3.38.3 */

const file$a = "node_modules/nature-immersive-svelte-components/src/components/LogoFacebook/index.svelte";

function create_fragment$a(ctx) {
	let svg;
	let path0;
	let path1;
	let svg_class_value;
	let svg_height_value;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[2]);
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path0 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path0).forEach(detach_dev);
			path1 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path1).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, /*title*/ ctx[2]);
			span_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path0, "d", "M30,15A15,15,0,1,1,15,0,15,15,0,0,1,30,15ZM15,2A13,13,0,1,0,28,15,13,13,0,0,0,15,2Z");
			add_location(path0, file$a, 20, 2, 301);
			attr_dev(path1, "d", "M15.89625,22.8625 L12.57125,22.8625 L12.57125,15.02125 L10.90875,15.02125\n    L10.90875,12.31875 L12.57125,12.31875 L12.57125,10.69625 C12.57125,8.4925\n    13.50875,7.18 16.175,7.18 L18.39375,7.18 L18.39375,9.8825 L17.00625,9.8825\n    C15.96875,9.8825 15.9,10.26 15.9,10.965 L15.895,12.3175 L18.4075,12.3175\n    L18.115,15.02 L15.89625,15.02 L15.89625,22.8625 Z");
			add_location(path1, file$a, 23, 2, 412);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 30 30");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$a, 13, 0, 180);
			attr_dev(span, "class", "visually-hidden");
			add_location(span, file$a, 31, 0, 806);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path0);
			append_dev(svg, path1);
			insert_dev(target, t0, anchor);
			insert_dev(target, span, anchor);
			append_dev(span, t1);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}

			if (dirty & /*title*/ 4) set_data_dev(t1, /*title*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$a.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$a($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoFacebook", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	let { title = "Facebook" } = $$props;
	const writable_props = ["className", "height", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoFacebook> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	$$self.$capture_state = () => ({ className, height, title });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height, title];
}

class LogoFacebook extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$a, create_fragment$a, safe_not_equal, { className: 0, height: 1, title: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoFacebook",
			options,
			id: create_fragment$a.name
		});
	}

	get className() {
		throw new Error("<LogoFacebook>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoFacebook>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoFacebook>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoFacebook>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<LogoFacebook>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<LogoFacebook>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoTwitter/index.svelte generated by Svelte v3.38.3 */

const file$9 = "node_modules/nature-immersive-svelte-components/src/components/LogoTwitter/index.svelte";

function create_fragment$9(ctx) {
	let svg;
	let path0;
	let path1;
	let svg_class_value;
	let svg_height_value;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[2]);
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path0 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path0).forEach(detach_dev);
			path1 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path1).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, /*title*/ ctx[2]);
			span_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path0, "d", "M30,15A15,15,0,1,1,15,0,15,15,0,0,1,30,15ZM15,2A13,13,0,1,0,28,15,13,13,0,0,0,15,2Z");
			add_location(path0, file$9, 20, 2, 300);
			attr_dev(path1, "d", "M20.8125,11.4875 C21.42,11.10375 21.8875,10.49625 22.105,9.7725\n    C21.5375,10.1275 20.90875,10.385 20.23875,10.5225 C19.70625,9.9225\n    18.9425,9.545 18.0975,9.545 C16.475,9.545 15.16,10.9325 15.16,12.6425\n    C15.16,12.885 15.185,13.1225 15.235,13.3475 C12.7975,13.2175 10.63125,11.985\n    9.1825,10.11 C8.93,10.56875 8.785,11.10125 8.785,11.66875 C8.785,12.74375\n    9.30375,13.69125 10.09125,14.2475 C9.61125,14.23125 9.1575,14.09\n    8.76125,13.86 L8.76125,13.8975 C8.76125,15.3975 9.77375,16.65125\n    11.11875,16.935 C10.87125,17.0075 10.6125,17.04375 10.34375,17.04375\n    C10.15625,17.04375 9.96875,17.025 9.79125,16.98875 C10.16625,18.22125\n    11.24875,19.11875 12.535,19.1425 C11.52875,19.97375 10.2625,20.4675\n    8.885,20.4675 C8.6475,20.4675 8.415,20.455 8.185,20.42625 C9.485,21.30375\n    11.02875,21.81625 12.6875,21.81625 C18.09,21.81625 21.04375,17.095\n    21.04375,13.00125 L21.03625,12.60125 C21.61125,12.16375 22.11125,11.6175\n    22.50125,10.99625 C21.97375,11.2425 21.4075,11.40875 20.81375,11.48375\n    L20.8125,11.4875 Z");
			add_location(path1, file$9, 23, 2, 411);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 30 30");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$9, 13, 0, 179);
			attr_dev(span, "class", "visually-hidden");
			add_location(span, file$9, 41, 0, 1492);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path0);
			append_dev(svg, path1);
			insert_dev(target, t0, anchor);
			insert_dev(target, span, anchor);
			append_dev(span, t1);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}

			if (dirty & /*title*/ 4) set_data_dev(t1, /*title*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$9.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$9($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoTwitter", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	let { title = "Twitter" } = $$props;
	const writable_props = ["className", "height", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoTwitter> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	$$self.$capture_state = () => ({ className, height, title });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height, title];
}

class LogoTwitter extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$9, create_fragment$9, safe_not_equal, { className: 0, height: 1, title: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoTwitter",
			options,
			id: create_fragment$9.name
		});
	}

	get className() {
		throw new Error("<LogoTwitter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoTwitter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoTwitter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoTwitter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<LogoTwitter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<LogoTwitter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoEmail/index.svelte generated by Svelte v3.38.3 */

const file$8 = "node_modules/nature-immersive-svelte-components/src/components/LogoEmail/index.svelte";

function create_fragment$8(ctx) {
	let svg;
	let path0;
	let path1;
	let svg_class_value;
	let svg_height_value;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[2]);
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path0 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path0).forEach(detach_dev);
			path1 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path1).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, /*title*/ ctx[2]);
			span_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path0, "d", "M30,15A15,15,0,1,1,15,0,15,15,0,0,1,30,15ZM15,2A13,13,0,1,0,28,15,13,13,0,0,0,15,2Z");
			add_location(path0, file$8, 20, 2, 298);
			attr_dev(path1, "d", "M15,15.3269887 L10.6248577,11.9177869 C10.4236021,11.7609644\n    10.1299323,11.7927468 9.96892789,11.988775 C9.80792343,12.1848031\n    9.84055341,12.4708451 10.041809,12.6276676 L14.7012493,16.2584003\n    C14.8680779,16.3940555 15.1152493,16.4013884 15.2915244,16.2640313\n    C15.2939898,16.2622325 15.2963784,16.2603294 15.2987507,16.2584003\n    L19.958191,12.6276676 C20.1594466,12.4708451 20.1920766,12.1848031\n    20.0310721,11.988775 C19.8700677,11.7927468 19.5763979,11.7609644\n    19.3751423,11.9177869 L15,15.3269887 Z M9,10 L21,10 C21.5522847,10\n    22,10.4477153 22,11 L22,19 C22,19.5522847 21.5522847,20 21,20 L9,20\n    C8.44771525,20 8,19.5522847 8,19 L8,11 C8,10.4477153 8.44771525,10 9,10 Z");
			add_location(path1, file$8, 23, 2, 409);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 30 30");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$8, 13, 0, 177);
			attr_dev(span, "class", "visually-hidden");
			add_location(span, file$8, 36, 0, 1146);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path0);
			append_dev(svg, path1);
			insert_dev(target, t0, anchor);
			insert_dev(target, span, anchor);
			append_dev(span, t1);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}

			if (dirty & /*title*/ 4) set_data_dev(t1, /*title*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$8.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$8($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoEmail", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	let { title = "Email" } = $$props;
	const writable_props = ["className", "height", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoEmail> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	$$self.$capture_state = () => ({ className, height, title });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height, title];
}

class LogoEmail extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$8, create_fragment$8, safe_not_equal, { className: 0, height: 1, title: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoEmail",
			options,
			id: create_fragment$8.name
		});
	}

	get className() {
		throw new Error("<LogoEmail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoEmail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoEmail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoEmail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<LogoEmail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<LogoEmail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const generateSocialURLs = (doi, articleURL, title, description) => {
  const facebookBaseURL = "https://www.facebook.com/sharer/sharer.php?u=";
  const twitterBaseURL = "https://twitter.com/intent/tweet?text=";
  const emailBaseURL = "mailto:?";

  const pdfURL = `public/pdf/${doi}.pdf`;

  const altPdfURL = `public/pdf/${doi}-alt.pdf`;

  const facebookCustom = `${articleURL}${doi}`;
  const facebookWebEncoded = encodeURIComponent(facebookCustom);
  const facebookURL = `${facebookBaseURL}${facebookWebEncoded}`;

  const twitterCustom = `${title}. ${description} ${articleURL}${doi}`;
  const twitterWebEncoded = encodeURIComponent(twitterCustom);
  const twitterURL = `${twitterBaseURL}${twitterWebEncoded}`;

  const emailCustom = `subject=${title}&body=${description} ${encodeURIComponent(
    articleURL
  )}${doi}`;
  const emailURL = `${emailBaseURL}${emailCustom}`;

  return {
    pdfURL,
    altPdfURL,
    facebookURL,
    twitterURL,
    emailURL,
  };
};

/* node_modules/nature-immersive-svelte-components/src/components/MenuSocialLinks/index.svelte generated by Svelte v3.38.3 */
const file$7 = "node_modules/nature-immersive-svelte-components/src/components/MenuSocialLinks/index.svelte";

// (29:0) <ClusterList clusterSpace="var(--s-2)">
function create_default_slot$1(ctx) {
	let li0;
	let a0;
	let logotwitter;
	let t0;
	let li1;
	let a1;
	let logofacebook;
	let t1;
	let li2;
	let a2;
	let logoemail;
	let current;

	logotwitter = new LogoTwitter({
			props: { height: /*logoHeight*/ ctx[0] },
			$$inline: true
		});

	logofacebook = new LogoFacebook({
			props: { height: /*logoHeight*/ ctx[0] },
			$$inline: true
		});

	logoemail = new LogoEmail({
			props: { height: /*logoHeight*/ ctx[0] },
			$$inline: true
		});

	const block = {
		c: function create() {
			li0 = element("li");
			a0 = element("a");
			create_component(logotwitter.$$.fragment);
			t0 = space();
			li1 = element("li");
			a1 = element("a");
			create_component(logofacebook.$$.fragment);
			t1 = space();
			li2 = element("li");
			a2 = element("a");
			create_component(logoemail.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			li0 = claim_element(nodes, "LI", {});
			var li0_nodes = children(li0);
			a0 = claim_element(li0_nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			claim_component(logotwitter.$$.fragment, a0_nodes);
			a0_nodes.forEach(detach_dev);
			li0_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			li1 = claim_element(nodes, "LI", {});
			var li1_nodes = children(li1);
			a1 = claim_element(li1_nodes, "A", { href: true, class: true });
			var a1_nodes = children(a1);
			claim_component(logofacebook.$$.fragment, a1_nodes);
			a1_nodes.forEach(detach_dev);
			li1_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			li2 = claim_element(nodes, "LI", {});
			var li2_nodes = children(li2);
			a2 = claim_element(li2_nodes, "A", { href: true, class: true });
			var a2_nodes = children(a2);
			claim_component(logoemail.$$.fragment, a2_nodes);
			a2_nodes.forEach(detach_dev);
			li2_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a0, "href", /*twitterURL*/ ctx[2]);
			attr_dev(a0, "class", "svelte-1jvspx4");
			add_location(a0, file$7, 30, 4, 713);
			add_location(li0, file$7, 29, 2, 704);
			attr_dev(a1, "href", /*facebookURL*/ ctx[1]);
			attr_dev(a1, "class", "svelte-1jvspx4");
			add_location(a1, file$7, 36, 4, 806);
			add_location(li1, file$7, 35, 2, 797);
			attr_dev(a2, "href", /*emailURL*/ ctx[3]);
			attr_dev(a2, "class", "svelte-1jvspx4");
			add_location(a2, file$7, 42, 4, 901);
			add_location(li2, file$7, 41, 2, 892);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li0, anchor);
			append_dev(li0, a0);
			mount_component(logotwitter, a0, null);
			insert_dev(target, t0, anchor);
			insert_dev(target, li1, anchor);
			append_dev(li1, a1);
			mount_component(logofacebook, a1, null);
			insert_dev(target, t1, anchor);
			insert_dev(target, li2, anchor);
			append_dev(li2, a2);
			mount_component(logoemail, a2, null);
			current = true;
		},
		p: function update(ctx, dirty) {
			const logotwitter_changes = {};
			if (dirty & /*logoHeight*/ 1) logotwitter_changes.height = /*logoHeight*/ ctx[0];
			logotwitter.$set(logotwitter_changes);
			const logofacebook_changes = {};
			if (dirty & /*logoHeight*/ 1) logofacebook_changes.height = /*logoHeight*/ ctx[0];
			logofacebook.$set(logofacebook_changes);
			const logoemail_changes = {};
			if (dirty & /*logoHeight*/ 1) logoemail_changes.height = /*logoHeight*/ ctx[0];
			logoemail.$set(logoemail_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(logotwitter.$$.fragment, local);
			transition_in(logofacebook.$$.fragment, local);
			transition_in(logoemail.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(logotwitter.$$.fragment, local);
			transition_out(logofacebook.$$.fragment, local);
			transition_out(logoemail.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li0);
			destroy_component(logotwitter);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(li1);
			destroy_component(logofacebook);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(li2);
			destroy_component(logoemail);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot$1.name,
		type: "slot",
		source: "(29:0) <ClusterList clusterSpace=\\\"var(--s-2)\\\">",
		ctx
	});

	return block;
}

function create_fragment$7(ctx) {
	let h2;
	let t0;
	let t1;
	let clusterlist;
	let current;

	clusterlist = new ClusterList({
			props: {
				clusterSpace: "var(--s-2)",
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			h2 = element("h2");
			t0 = text("Sharing links");
			t1 = space();
			create_component(clusterlist.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			h2 = claim_element(nodes, "H2", { class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, "Sharing links");
			h2_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			claim_component(clusterlist.$$.fragment, nodes);
			this.h();
		},
		h: function hydrate() {
			attr_dev(h2, "class", "visually-hidden");
			add_location(h2, file$7, 27, 0, 615);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h2, anchor);
			append_dev(h2, t0);
			insert_dev(target, t1, anchor);
			mount_component(clusterlist, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const clusterlist_changes = {};

			if (dirty & /*$$scope, logoHeight*/ 513) {
				clusterlist_changes.$$scope = { dirty, ctx };
			}

			clusterlist.$set(clusterlist_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(clusterlist.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(clusterlist.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h2);
			if (detaching) detach_dev(t1);
			destroy_component(clusterlist, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$7.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$7($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("MenuSocialLinks", slots, []);
	let { articleData } = $$props;
	let { logoHeight = 1.6 } = $$props;
	let { doi, articleURL, title, description } = articleData;
	let { facebookURL, twitterURL, emailURL } = generateSocialURLs(doi, articleURL, title, description);
	const writable_props = ["articleData", "logoHeight"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuSocialLinks> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("articleData" in $$props) $$invalidate(4, articleData = $$props.articleData);
		if ("logoHeight" in $$props) $$invalidate(0, logoHeight = $$props.logoHeight);
	};

	$$self.$capture_state = () => ({
		ClusterList,
		LogoFacebook,
		LogoTwitter,
		LogoEmail,
		articleData,
		logoHeight,
		generateSocialURLs,
		doi,
		articleURL,
		title,
		description,
		facebookURL,
		twitterURL,
		emailURL
	});

	$$self.$inject_state = $$props => {
		if ("articleData" in $$props) $$invalidate(4, articleData = $$props.articleData);
		if ("logoHeight" in $$props) $$invalidate(0, logoHeight = $$props.logoHeight);
		if ("doi" in $$props) doi = $$props.doi;
		if ("articleURL" in $$props) articleURL = $$props.articleURL;
		if ("title" in $$props) title = $$props.title;
		if ("description" in $$props) description = $$props.description;
		if ("facebookURL" in $$props) $$invalidate(1, facebookURL = $$props.facebookURL);
		if ("twitterURL" in $$props) $$invalidate(2, twitterURL = $$props.twitterURL);
		if ("emailURL" in $$props) $$invalidate(3, emailURL = $$props.emailURL);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [logoHeight, facebookURL, twitterURL, emailURL, articleData];
}

class MenuSocialLinks extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$7, create_fragment$7, safe_not_equal, { articleData: 4, logoHeight: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "MenuSocialLinks",
			options,
			id: create_fragment$7.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*articleData*/ ctx[4] === undefined && !("articleData" in props)) {
			console.warn("<MenuSocialLinks> was created without expected prop 'articleData'");
		}
	}

	get articleData() {
		throw new Error("<MenuSocialLinks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set articleData(value) {
		throw new Error("<MenuSocialLinks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get logoHeight() {
		throw new Error("<MenuSocialLinks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set logoHeight(value) {
		throw new Error("<MenuSocialLinks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoChevron/index.svelte generated by Svelte v3.38.3 */

const file$6 = "node_modules/nature-immersive-svelte-components/src/components/LogoChevron/index.svelte";

function create_fragment$6(ctx) {
	let svg;
	let path;
	let svg_class_value;
	let svg_height_value;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path, "d", "M20,14.3L6.8,1.2c-1.6-1.6-4.1-1.6-5.7,0s-1.6,4.1,0,5.7l16,16c1.6,1.6,4.1,1.6,5.7,0l16-16c1.6-1.6,1.6-4.1,0-5.7\n    s-4.1-1.6-5.7,0L20,14.3z");
			add_location(path, file$6, 19, 2, 268);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 40 24");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$6, 12, 0, 147);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$6.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$6($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoChevron", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	const writable_props = ["className", "height"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoChevron> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
	};

	$$self.$capture_state = () => ({ className, height });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height];
}

class LogoChevron extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$6, create_fragment$6, safe_not_equal, { className: 0, height: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoChevron",
			options,
			id: create_fragment$6.name
		});
	}

	get className() {
		throw new Error("<LogoChevron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoChevron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoChevron>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoChevron>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/ExpandButton/index.svelte generated by Svelte v3.38.3 */
const file$5 = "node_modules/nature-immersive-svelte-components/src/components/ExpandButton/index.svelte";

// (77:35) {:else}
function create_else_block$1(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text(/*message*/ ctx[3]);
		},
		l: function claim(nodes) {
			t = claim_text(nodes, /*message*/ ctx[3]);
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*message*/ 8) set_data_dev(t, /*message*/ ctx[3]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$1.name,
		type: "else",
		source: "(77:35) {:else}",
		ctx
	});

	return block;
}

// (77:4) {#if expanded}
function create_if_block$2(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text(/*expandedMessage*/ ctx[2]);
		},
		l: function claim(nodes) {
			t = claim_text(nodes, /*expandedMessage*/ ctx[2]);
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*expandedMessage*/ 4) set_data_dev(t, /*expandedMessage*/ ctx[2]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$2.name,
		type: "if",
		source: "(77:4) {#if expanded}",
		ctx
	});

	return block;
}

function create_fragment$5(ctx) {
	let button;
	let span0;
	let t;
	let span1;
	let logochevron;
	let button_class_value;
	let current;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*expanded*/ ctx[1]) return create_if_block$2;
		return create_else_block$1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);
	logochevron = new LogoChevron({ props: { height: "0.3" }, $$inline: true });

	const block = {
		c: function create() {
			button = element("button");
			span0 = element("span");
			if_block.c();
			t = space();
			span1 = element("span");
			create_component(logochevron.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			button = claim_element(nodes, "BUTTON", {
				"aria-expanded": true,
				class: true,
				"data-event-action": true,
				"data-event-category": true,
				"data-event-label": true,
				"data-theme": true,
				"data-track": true,
				type: true
			});

			var button_nodes = children(button);
			span0 = claim_element(button_nodes, "SPAN", {});
			var span0_nodes = children(span0);
			if_block.l(span0_nodes);
			span0_nodes.forEach(detach_dev);
			t = claim_space(button_nodes);
			span1 = claim_element(button_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			claim_component(logochevron.$$.fragment, span1_nodes);
			span1_nodes.forEach(detach_dev);
			button_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			add_location(span0, file$5, 75, 2, 1606);
			attr_dev(span1, "class", "toggle-icon svelte-1b75wvq");
			add_location(span1, file$5, 78, 2, 1682);
			attr_dev(button, "aria-expanded", /*expanded*/ ctx[1]);
			attr_dev(button, "class", button_class_value = "" + (null_to_empty(`expand-button ${/*className*/ ctx[0]}`) + " svelte-1b75wvq"));
			attr_dev(button, "data-event-action", "click");
			attr_dev(button, "data-event-category", /*message*/ ctx[3]);
			attr_dev(button, "data-event-label", "Expand button clicked");
			attr_dev(button, "data-theme", /*theme*/ ctx[4]);
			attr_dev(button, "data-track", "click");
			attr_dev(button, "type", "button");
			add_location(button, file$5, 61, 0, 1307);
		},
		m: function mount(target, anchor) {
			insert_dev(target, button, anchor);
			append_dev(button, span0);
			if_block.m(span0, null);
			append_dev(button, t);
			append_dev(button, span1);
			mount_component(logochevron, span1, null);
			/*button_binding*/ ctx[10](button);
			current = true;

			if (!mounted) {
				dispose = [
					listen_dev(button, "blur", /*blur_handler*/ ctx[7], false, false, false),
					listen_dev(button, "click", /*click_handler*/ ctx[8], false, false, false),
					listen_dev(button, "focus", /*focus_handler*/ ctx[9], false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(span0, null);
				}
			}

			if (!current || dirty & /*expanded*/ 2) {
				attr_dev(button, "aria-expanded", /*expanded*/ ctx[1]);
			}

			if (!current || dirty & /*className*/ 1 && button_class_value !== (button_class_value = "" + (null_to_empty(`expand-button ${/*className*/ ctx[0]}`) + " svelte-1b75wvq"))) {
				attr_dev(button, "class", button_class_value);
			}

			if (!current || dirty & /*message*/ 8) {
				attr_dev(button, "data-event-category", /*message*/ ctx[3]);
			}

			if (!current || dirty & /*theme*/ 16) {
				attr_dev(button, "data-theme", /*theme*/ ctx[4]);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(logochevron.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(logochevron.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(button);
			if_block.d();
			destroy_component(logochevron);
			/*button_binding*/ ctx[10](null);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$5.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("ExpandButton", slots, []);
	let { className = "" } = $$props;
	let { expanded = false } = $$props;
	let { expandedMessage = "Close" } = $$props;
	let { message = "Open" } = $$props;
	let { theme = "" } = $$props;
	let buttonElement;

	function focusButton() {
		buttonElement.focus();
	}

	const writable_props = ["className", "expanded", "expandedMessage", "message", "theme"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ExpandButton> was created with unknown prop '${key}'`);
	});

	function blur_handler(event) {
		bubble.call(this, $$self, event);
	}

	function click_handler(event) {
		bubble.call(this, $$self, event);
	}

	function focus_handler(event) {
		bubble.call(this, $$self, event);
	}

	function button_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			buttonElement = $$value;
			$$invalidate(5, buttonElement);
		});
	}

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("expanded" in $$props) $$invalidate(1, expanded = $$props.expanded);
		if ("expandedMessage" in $$props) $$invalidate(2, expandedMessage = $$props.expandedMessage);
		if ("message" in $$props) $$invalidate(3, message = $$props.message);
		if ("theme" in $$props) $$invalidate(4, theme = $$props.theme);
	};

	$$self.$capture_state = () => ({
		LogoChevron,
		className,
		expanded,
		expandedMessage,
		message,
		theme,
		buttonElement,
		focusButton
	});

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("expanded" in $$props) $$invalidate(1, expanded = $$props.expanded);
		if ("expandedMessage" in $$props) $$invalidate(2, expandedMessage = $$props.expandedMessage);
		if ("message" in $$props) $$invalidate(3, message = $$props.message);
		if ("theme" in $$props) $$invalidate(4, theme = $$props.theme);
		if ("buttonElement" in $$props) $$invalidate(5, buttonElement = $$props.buttonElement);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		className,
		expanded,
		expandedMessage,
		message,
		theme,
		buttonElement,
		focusButton,
		blur_handler,
		click_handler,
		focus_handler,
		button_binding
	];
}

class ExpandButton extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init$1(this, options, instance$5, create_fragment$5, safe_not_equal, {
			className: 0,
			expanded: 1,
			expandedMessage: 2,
			message: 3,
			theme: 4,
			focusButton: 6
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "ExpandButton",
			options,
			id: create_fragment$5.name
		});
	}

	get className() {
		throw new Error("<ExpandButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get expanded() {
		throw new Error("<ExpandButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set expanded(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get expandedMessage() {
		throw new Error("<ExpandButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set expandedMessage(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get message() {
		throw new Error("<ExpandButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set message(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get theme() {
		throw new Error("<ExpandButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set theme(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get focusButton() {
		return this.$$.ctx[6];
	}

	set focusButton(value) {
		throw new Error("<ExpandButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoNature/index.svelte generated by Svelte v3.38.3 */

const file$4 = "node_modules/nature-immersive-svelte-components/src/components/LogoNature/index.svelte";

function create_fragment$4(ctx) {
	let svg;
	let path0;
	let path1;
	let path2;
	let path3;
	let path4;
	let path5;
	let svg_class_value;
	let svg_height_value;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			path2 = svg_element("path");
			path3 = svg_element("path");
			path4 = svg_element("path");
			path5 = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text(/*title*/ ctx[2]);
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					"aria-hidden": true,
					focusable: true
				},
				1
			);

			var svg_nodes = children(svg);
			path0 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path0).forEach(detach_dev);
			path1 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path1).forEach(detach_dev);
			path2 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path2).forEach(detach_dev);
			path3 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path3).forEach(detach_dev);
			path4 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path4).forEach(detach_dev);
			path5 = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path5).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, /*title*/ ctx[2]);
			span_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path0, "d", "M12.8 8.4l.1.1v8.4h.2c1.7-4.8 6-8.7 12.2-8.7 8.1 0 10.5 4 10.5\n    11.7v15.2c0 4.6.3 9.4 1.4 13h-13c1.1-3.4 1.2-7.6\n    1.2-12.6V21.1c0-3.5-1.4-5.2-5.3-5.2-3 0-5.2.8-6.9 2.3v17.4c0 5 .1 9.2 1.2\n    12.6H1.5c1.2-3.6 1.4-8.4 1.4-13V21.1c0-3.8-1.4-7.2-3-9l12.9-3.7");
			add_location(path0, file$4, 20, 2, 300);
			attr_dev(path1, "d", "M59.8 40.7V26.5c-.8 1.2-1.8 1.9-4.7 3.2-3.7 1.8-5 3.8-5 7.9 0 3.4 1.9 5.6\n    4.9 5.6 3 .1 4-1 4.8-2.5zM56.4 8.3c10.1 0 13.8 4 13.8 12.2v17.2c0 3.1 1.2 4\n    3.7 4 .4 0 1.7-.2 2.1-.6-.2 1.2-.4 1.8-.6 2.5-1.2 3.4-3.3 5.4-7.5 5.4-5\n    0-7.5-3.5-7.6-7.1h-.1c-1.7 5-4.9 7.1-10 7.1-6.3 0-10.3-3.8-10.3-9.7 0-6.2\n    5.6-8.9 11.5-11.2 5.6-2.2 8.6-3.8 8.6-7.8v-.8c0-4.4-1.4-6.6-5.5-6.6-2.6\n    0-3.5 1.2-4.1 3.7-.8 3.8-2.3 5.1-4.8 5.1-2.2 0-4.3-1.5-4.3-4.3-.2-5.4\n    7.3-9.1 15.1-9.1z");
			add_location(path1, file$4, 26, 2, 589);
			attr_dev(path2, "d", "M98.7 43.9C97.4 47 94.1 49 89.4 49c-8\n    0-11.1-4-11.1-11.4v-23h-3.8v-.3L88.4 0l.2.1v9.1h10l-1 5.5h-8.9V36c0 4.1 1.7\n    5.7 5.4 5.7 2.8 0 4.3-.4 5.6-1.1-.3 1.4-.5 2.2-1 3.3");
			add_location(path2, file$4, 35, 2, 1096);
			attr_dev(path3, "d", "M113.1 8.9v27c0 4 1.6 6.3 5.5 6.3 3.3 0 5.8-1.1\n    7.2-3V20.9c0-4-.4-7.4-1.7-10.8l12-1.2v27.6c0 6.1.6 8.8 1.6\n    11.7H126v-7.8h-.1c-1.7 5-4.9 8.6-11.6 8.6-8.5\n    0-11.6-5.1-11.6-12.8V20.9c0-4-.4-7.4-1.7-10.8l12.1-1.2");
			add_location(path3, file$4, 40, 2, 1298);
			attr_dev(path4, "d", "M152.5 18.3c1.7-7.2 5-10 9.4-10 4 0 6.1 2.1 6.1 5.4 0 3-1.7 5.4-4.8\n    5.4-1.8 0-2.9-.8-3.7-1.6-.9-.8-1.5-1.7-2.4-1.7-2.1 0-4.4 3.5-4.4 9.4V35c0\n    4.8.4 9.6 1.3 13.2h-13c1.2-3.6 1.4-8.4\n    1.4-13V21.1c0-3.8-1.4-7.2-3-9l12.8-3.7.1.1v9.8h.2");
			add_location(path4, file$4, 46, 2, 1545);
			attr_dev(path5, "d", "M177.2 24l13.1-1.2c-.1-6.2-1.1-9.9-5.4-9.9-4.4.1-7 3.6-7.7 11.1zm7.8\n    25c-10 0-18.2-6.6-18.2-19.3 0-12.9 7.9-21.5 18.5-21.5 10.1 0 14.8 6.4 14.8\n    18.5h-22.9v1.2c0 9.7 5 13.6 11.9 13.6 6.2 0 9-2.5 10.8-4.3l.2.6C198.3 43.6\n    193.7 49 185 49z");
			add_location(path5, file$4, 52, 2, 1815);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 200 49");
			attr_dev(svg, "aria-hidden", "true");
			attr_dev(svg, "focusable", "false");
			add_location(svg, file$4, 13, 0, 178);
			attr_dev(span, "class", "visually-hidden");
			add_location(span, file$4, 59, 0, 2095);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path0);
			append_dev(svg, path1);
			append_dev(svg, path2);
			append_dev(svg, path3);
			append_dev(svg, path4);
			append_dev(svg, path5);
			insert_dev(target, t0, anchor);
			insert_dev(target, span, anchor);
			append_dev(span, t1);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}

			if (dirty & /*title*/ 4) set_data_dev(t1, /*title*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$4.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$4($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoNature", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	let { title = "Nature" } = $$props;
	const writable_props = ["className", "height", "title"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoNature> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	$$self.$capture_state = () => ({ className, height, title });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("title" in $$props) $$invalidate(2, title = $$props.title);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height, title];
}

class LogoNature extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$4, create_fragment$4, safe_not_equal, { className: 0, height: 1, title: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoNature",
			options,
			id: create_fragment$4.name
		});
	}

	get className() {
		throw new Error("<LogoNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get title() {
		throw new Error("<LogoNature>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set title(value) {
		throw new Error("<LogoNature>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/LogoDownloadFile/index.svelte generated by Svelte v3.38.3 */

const file$3 = "node_modules/nature-immersive-svelte-components/src/components/LogoDownloadFile/index.svelte";

function create_fragment$3(ctx) {
	let svg;
	let path;
	let svg_class_value;
	let svg_height_value;

	const block = {
		c: function create() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l: function claim(nodes) {
			svg = claim_element(
				nodes,
				"svg",
				{
					class: true,
					height: true,
					viewBox: true,
					focusable: true,
					"aria-hidden": true
				},
				1
			);

			var svg_nodes = children(svg);
			path = claim_element(svg_nodes, "path", { d: true }, 1);
			children(path).forEach(detach_dev);
			svg_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(path, "d", "M15.2,0c0.9,0,2.2,0.5,2.9,1.2l7.7,7.6c0.7,0.7,1.2,1.9,1.2,2.9v15c0,1.8-1.5,3.3-3.4,3.3H3.4\n    C1.5,30,0,28.5,0,26.7V3.3C0,1.5,1.5,0,3.4,0L15.2,0z\n    M15.2,1.7H3.4c-0.9,0-1.7,0.7-1.7,1.7v23.3c0,0.9,0.8,1.7,1.7,1.7h20.3\n    c0.9,0,1.7-0.8,1.7-1.7v-15c0-0.5-0.4-1.3-0.7-1.7l-7.7-7.6C16.5,2,15.7,1.7,15.2,1.7z\n    M12.7,8.3c0.5,0,0.8,0.4,0.8,0.8v10.2l2.9-3\n    c0.3-0.3,0.9-0.3,1.2,0c0.3,0.3,0.3,0.8,0,1.2l-4.4,4.3c-0.3,0.3-0.9,0.3-1.2,0l-4.4-4.3c-0.3-0.3-0.3-0.9,0-1.2\n    c0.3-0.3,0.9-0.3,1.2,0l2.9,3V9.2C11.8,8.7,12.2,8.3,12.7,8.3z");
			add_location(path, file$3, 19, 2, 268);
			attr_dev(svg, "class", svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"));
			attr_dev(svg, "height", svg_height_value = `${/*height*/ ctx[1]}em`);
			attr_dev(svg, "viewBox", "0 0 27 30");
			attr_dev(svg, "focusable", "false");
			attr_dev(svg, "aria-hidden", "true");
			add_location(svg, file$3, 12, 0, 147);
		},
		m: function mount(target, anchor) {
			insert_dev(target, svg, anchor);
			append_dev(svg, path);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*className*/ ctx[0]) + " svelte-fftrry"))) {
				attr_dev(svg, "class", svg_class_value);
			}

			if (dirty & /*height*/ 2 && svg_height_value !== (svg_height_value = `${/*height*/ ctx[1]}em`)) {
				attr_dev(svg, "height", svg_height_value);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(svg);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$3.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$3($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("LogoDownloadFile", slots, []);
	let { className = "" } = $$props;
	let { height = 1 } = $$props;
	const writable_props = ["className", "height"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LogoDownloadFile> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
	};

	$$self.$capture_state = () => ({ className, height });

	$$self.$inject_state = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [className, height];
}

class LogoDownloadFile extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$3, create_fragment$3, safe_not_equal, { className: 0, height: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "LogoDownloadFile",
			options,
			id: create_fragment$3.name
		});
	}

	get className() {
		throw new Error("<LogoDownloadFile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set className(value) {
		throw new Error("<LogoDownloadFile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get height() {
		throw new Error("<LogoDownloadFile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set height(value) {
		throw new Error("<LogoDownloadFile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/MenuPdfDownload/index.svelte generated by Svelte v3.38.3 */
const file$2 = "node_modules/nature-immersive-svelte-components/src/components/MenuPdfDownload/index.svelte";

function create_fragment$2(ctx) {
	let a;
	let span0;
	let t0;
	let t1;
	let span1;
	let logodownloadfile;
	let a_href_value;
	let current;

	logodownloadfile = new LogoDownloadFile({
			props: { height: /*logoHeight*/ ctx[1] },
			$$inline: true
		});

	const block = {
		c: function create() {
			a = element("a");
			span0 = element("span");
			t0 = text("PDF download");
			t1 = space();
			span1 = element("span");
			create_component(logodownloadfile.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			a = claim_element(nodes, "A", {
				"data-event-action": true,
				"data-event-category": true,
				"data-event-label": true,
				"data-track": true,
				href: true,
				class: true
			});

			var a_nodes = children(a);
			span0 = claim_element(a_nodes, "SPAN", {});
			var span0_nodes = children(span0);
			t0 = claim_text(span0_nodes, "PDF download");
			span0_nodes.forEach(detach_dev);
			t1 = claim_space(a_nodes);
			span1 = claim_element(a_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			claim_component(logodownloadfile.$$.fragment, span1_nodes);
			span1_nodes.forEach(detach_dev);
			a_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			add_location(span0, file$2, 26, 2, 447);
			attr_dev(span1, "class", "pdf-icon");
			add_location(span1, file$2, 27, 2, 475);
			attr_dev(a, "data-event-action", "click");
			attr_dev(a, "data-event-category", "menu");
			attr_dev(a, "data-event-label", "PDF dowload");
			attr_dev(a, "data-track", "click");
			attr_dev(a, "href", a_href_value = `pdf/${/*doi*/ ctx[0]}.pdf`);
			attr_dev(a, "class", "svelte-vxwq6j");
			add_location(a, file$2, 19, 0, 303);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a, anchor);
			append_dev(a, span0);
			append_dev(span0, t0);
			append_dev(a, t1);
			append_dev(a, span1);
			mount_component(logodownloadfile, span1, null);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const logodownloadfile_changes = {};
			if (dirty & /*logoHeight*/ 2) logodownloadfile_changes.height = /*logoHeight*/ ctx[1];
			logodownloadfile.$set(logodownloadfile_changes);

			if (!current || dirty & /*doi*/ 1 && a_href_value !== (a_href_value = `pdf/${/*doi*/ ctx[0]}.pdf`)) {
				attr_dev(a, "href", a_href_value);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(logodownloadfile.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(logodownloadfile.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(a);
			destroy_component(logodownloadfile);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$2.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("MenuPdfDownload", slots, []);
	let { doi } = $$props;
	let { logoHeight = 1.6 } = $$props;
	const writable_props = ["doi", "logoHeight"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuPdfDownload> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("doi" in $$props) $$invalidate(0, doi = $$props.doi);
		if ("logoHeight" in $$props) $$invalidate(1, logoHeight = $$props.logoHeight);
	};

	$$self.$capture_state = () => ({ LogoDownloadFile, doi, logoHeight });

	$$self.$inject_state = $$props => {
		if ("doi" in $$props) $$invalidate(0, doi = $$props.doi);
		if ("logoHeight" in $$props) $$invalidate(1, logoHeight = $$props.logoHeight);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [doi, logoHeight];
}

class MenuPdfDownload extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$2, create_fragment$2, safe_not_equal, { doi: 0, logoHeight: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "MenuPdfDownload",
			options,
			id: create_fragment$2.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*doi*/ ctx[0] === undefined && !("doi" in props)) {
			console.warn("<MenuPdfDownload> was created without expected prop 'doi'");
		}
	}

	get doi() {
		throw new Error("<MenuPdfDownload>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set doi(value) {
		throw new Error("<MenuPdfDownload>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get logoHeight() {
		throw new Error("<MenuPdfDownload>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set logoHeight(value) {
		throw new Error("<MenuPdfDownload>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/nature-immersive-svelte-components/src/components/Menu/index.svelte generated by Svelte v3.38.3 */

const { window: window_1 } = globals;
const file$1 = "node_modules/nature-immersive-svelte-components/src/components/Menu/index.svelte";
const get_heading_slot_changes = dirty => ({});
const get_heading_slot_context = ctx => ({});

// (155:4) {#if pdfAvailable}
function create_if_block_4(ctx) {
	let li;
	let menupdfdownload;
	let current;

	menupdfdownload = new MenuPdfDownload({
			props: {
				logoHeight: /*logoHeight*/ ctx[10],
				doi: /*doi*/ ctx[9]
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			li = element("li");
			create_component(menupdfdownload.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			claim_component(menupdfdownload.$$.fragment, li_nodes);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(li, "class", "svelte-seamqm");
			add_location(li, file$1, 155, 6, 3448);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			mount_component(menupdfdownload, li, null);
			current = true;
		},
		p: noop,
		i: function intro(local) {
			if (current) return;
			transition_in(menupdfdownload.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(menupdfdownload.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
			destroy_component(menupdfdownload);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_4.name,
		type: "if",
		source: "(155:4) {#if pdfAvailable}",
		ctx
	});

	return block;
}

// (163:4) {#if menuLinks && menuLinks.length}
function create_if_block_1(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_2, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*mounted*/ ctx[1]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			if_block.l(nodes);
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1.name,
		type: "if",
		source: "(163:4) {#if menuLinks && menuLinks.length}",
		ctx
	});

	return block;
}

// (187:6) {:else}
function create_else_block(ctx) {
	let li;
	let a;
	let t;

	const block = {
		c: function create() {
			li = element("li");
			a = element("a");
			t = text("Menu");
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			a = claim_element(li_nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			t = claim_text(a_nodes, "Menu");
			a_nodes.forEach(detach_dev);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a, "href", "#menu");
			attr_dev(a, "class", "svelte-seamqm");
			add_location(a, file$1, 188, 10, 4304);
			attr_dev(li, "class", "svelte-seamqm");
			add_location(li, file$1, 187, 8, 4289);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			append_dev(li, a);
			append_dev(a, t);
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(187:6) {:else}",
		ctx
	});

	return block;
}

// (164:6) {#if mounted}
function create_if_block_2(ctx) {
	let li;
	let expandbutton;
	let t;
	let current;

	expandbutton = new ExpandButton({
			props: {
				expanded: /*menuIsExpanded*/ ctx[2],
				expandedMessage: "Menu",
				message: "Menu",
				theme: "menu"
			},
			$$inline: true
		});

	expandbutton.$on("blur", function () {
		if (is_function(/*handleButtonBlur*/ ctx[4])) /*handleButtonBlur*/ ctx[4].apply(this, arguments);
	});

	expandbutton.$on("click", /*handleButtonClick*/ ctx[11]);
	expandbutton.$on("focus", /*handleButtonFocus*/ ctx[13]);
	let if_block = /*menuIsExpanded*/ ctx[2] && create_if_block_3(ctx);

	const block = {
		c: function create() {
			li = element("li");
			create_component(expandbutton.$$.fragment);
			t = space();
			if (if_block) if_block.c();
			this.h();
		},
		l: function claim(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			claim_component(expandbutton.$$.fragment, li_nodes);
			t = claim_space(li_nodes);
			if (if_block) if_block.l(li_nodes);
			li_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(li, "class", "svelte-seamqm");
			add_location(li, file$1, 164, 8, 3635);
		},
		m: function mount(target, anchor) {
			insert_dev(target, li, anchor);
			mount_component(expandbutton, li, null);
			append_dev(li, t);
			if (if_block) if_block.m(li, null);
			current = true;
		},
		p: function update(new_ctx, dirty) {
			ctx = new_ctx;
			const expandbutton_changes = {};
			if (dirty & /*menuIsExpanded*/ 4) expandbutton_changes.expanded = /*menuIsExpanded*/ ctx[2];
			expandbutton.$set(expandbutton_changes);

			if (/*menuIsExpanded*/ ctx[2]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*menuIsExpanded*/ 4) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_3(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(li, null);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(expandbutton.$$.fragment, local);
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(expandbutton.$$.fragment, local);
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(li);
			destroy_component(expandbutton);
			if (if_block) if_block.d();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_2.name,
		type: "if",
		source: "(164:6) {#if mounted}",
		ctx
	});

	return block;
}

// (176:10) {#if menuIsExpanded}
function create_if_block_3(ctx) {
	let menulist;
	let updating_lastMenuLinkElem;
	let current;

	function menulist_lastMenuLinkElem_binding(value) {
		/*menulist_lastMenuLinkElem_binding*/ ctx[18](value);
	}

	let menulist_props = {
		logoHeight: /*logoHeight*/ ctx[10],
		menuLinks: /*menuLinks*/ ctx[7],
		menuHeight: /*$menuHeight*/ ctx[6]
	};

	if (/*lastMenuLinkElem*/ ctx[3] !== void 0) {
		menulist_props.lastMenuLinkElem = /*lastMenuLinkElem*/ ctx[3];
	}

	menulist = new MenuList({ props: menulist_props, $$inline: true });
	binding_callbacks.push(() => bind(menulist, "lastMenuLinkElem", menulist_lastMenuLinkElem_binding));
	menulist.$on("blur", /*handleMenuLinkBlur*/ ctx[14]);
	menulist.$on("focus", /*handleMenuLinkFocus*/ ctx[12]);

	const block = {
		c: function create() {
			create_component(menulist.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(menulist.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(menulist, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const menulist_changes = {};
			if (dirty & /*$menuHeight*/ 64) menulist_changes.menuHeight = /*$menuHeight*/ ctx[6];

			if (!updating_lastMenuLinkElem && dirty & /*lastMenuLinkElem*/ 8) {
				updating_lastMenuLinkElem = true;
				menulist_changes.lastMenuLinkElem = /*lastMenuLinkElem*/ ctx[3];
				add_flush_callback(() => updating_lastMenuLinkElem = false);
			}

			menulist.$set(menulist_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(menulist.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(menulist.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(menulist, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_3.name,
		type: "if",
		source: "(176:10) {#if menuIsExpanded}",
		ctx
	});

	return block;
}

// (200:0) {#if !mounted}
function create_if_block$1(ctx) {
	let menuliststatic;
	let current;

	menuliststatic = new MenuListStatic({
			props: { menuLinks: /*menuLinks*/ ctx[7] },
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(menuliststatic.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(menuliststatic.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(menuliststatic, target, anchor);
			current = true;
		},
		p: noop,
		i: function intro(local) {
			if (current) return;
			transition_in(menuliststatic.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(menuliststatic.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(menuliststatic, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(200:0) {#if !mounted}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let a0;
	let t0;
	let t1;
	let header;
	let ul;
	let li0;
	let a1;
	let logonature;
	let t2;
	let t3;
	let li1;
	let menusociallinks;
	let t4;
	let t5;
	let t6;
	let t7;
	let if_block2_anchor;
	let current;
	let mounted;
	let dispose;

	logonature = new LogoNature({
			props: { height: /*logoHeight*/ ctx[10] },
			$$inline: true
		});

	let if_block0 = /*pdfAvailable*/ ctx[8] && create_if_block_4(ctx);

	menusociallinks = new MenuSocialLinks({
			props: { articleData: /*articleData*/ ctx[0] },
			$$inline: true
		});

	let if_block1 = /*menuLinks*/ ctx[7] && /*menuLinks*/ ctx[7].length && create_if_block_1(ctx);
	const heading_slot_template = /*#slots*/ ctx[17].heading;
	const heading_slot = create_slot(heading_slot_template, ctx, /*$$scope*/ ctx[16], get_heading_slot_context);
	const default_slot_template = /*#slots*/ ctx[17].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);
	let if_block2 = !/*mounted*/ ctx[1] && create_if_block$1(ctx);

	const block = {
		c: function create() {
			a0 = element("a");
			t0 = text("Skip to main content");
			t1 = space();
			header = element("header");
			ul = element("ul");
			li0 = element("li");
			a1 = element("a");
			create_component(logonature.$$.fragment);
			t2 = space();
			if (if_block0) if_block0.c();
			t3 = space();
			li1 = element("li");
			create_component(menusociallinks.$$.fragment);
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			if (heading_slot) heading_slot.c();
			t6 = space();
			if (default_slot) default_slot.c();
			t7 = space();
			if (if_block2) if_block2.c();
			if_block2_anchor = empty();
			this.h();
		},
		l: function claim(nodes) {
			a0 = claim_element(nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "Skip to main content");
			a0_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			header = claim_element(nodes, "HEADER", {});
			var header_nodes = children(header);
			ul = claim_element(header_nodes, "UL", { class: true, "data-theme": true });
			var ul_nodes = children(ul);
			li0 = claim_element(ul_nodes, "LI", { class: true });
			var li0_nodes = children(li0);

			a1 = claim_element(li0_nodes, "A", {
				class: true,
				"data-event-action": true,
				"data-event-category": true,
				"data-event-label": true,
				"data-track": true,
				href: true
			});

			var a1_nodes = children(a1);
			claim_component(logonature.$$.fragment, a1_nodes);
			a1_nodes.forEach(detach_dev);
			li0_nodes.forEach(detach_dev);
			t2 = claim_space(ul_nodes);
			if (if_block0) if_block0.l(ul_nodes);
			t3 = claim_space(ul_nodes);
			li1 = claim_element(ul_nodes, "LI", { class: true });
			var li1_nodes = children(li1);
			claim_component(menusociallinks.$$.fragment, li1_nodes);
			li1_nodes.forEach(detach_dev);
			t4 = claim_space(ul_nodes);
			if (if_block1) if_block1.l(ul_nodes);
			ul_nodes.forEach(detach_dev);
			t5 = claim_space(header_nodes);
			if (heading_slot) heading_slot.l(header_nodes);
			header_nodes.forEach(detach_dev);
			t6 = claim_space(nodes);
			if (default_slot) default_slot.l(nodes);
			t7 = claim_space(nodes);
			if (if_block2) if_block2.l(nodes);
			if_block2_anchor = empty();
			this.h();
		},
		h: function hydrate() {
			attr_dev(a0, "href", "#main-content");
			attr_dev(a0, "class", "skip-link font-family:sans-serif svelte-seamqm");
			add_location(a0, file$1, 131, 0, 2901);
			attr_dev(a1, "class", "link-with-svg svelte-seamqm");
			attr_dev(a1, "data-event-action", "click");
			attr_dev(a1, "data-event-category", "menu");
			attr_dev(a1, "data-event-label", "nature.com");
			attr_dev(a1, "data-track", "click");
			attr_dev(a1, "href", "https://www.nature.com");
			add_location(a1, file$1, 142, 6, 3141);
			attr_dev(li0, "class", "flex-grow svelte-seamqm");
			add_location(li0, file$1, 141, 4, 3112);
			attr_dev(li1, "class", "svelte-seamqm");
			add_location(li1, file$1, 158, 4, 3511);
			attr_dev(ul, "class", "menu-container flex-wrap:wrap svelte-seamqm");
			attr_dev(ul, "data-theme", "menu");
			add_location(ul, file$1, 136, 2, 3007);
			add_location(header, file$1, 135, 0, 2996);
		},
		m: function mount(target, anchor) {
			insert_dev(target, a0, anchor);
			append_dev(a0, t0);
			insert_dev(target, t1, anchor);
			insert_dev(target, header, anchor);
			append_dev(header, ul);
			append_dev(ul, li0);
			append_dev(li0, a1);
			mount_component(logonature, a1, null);
			append_dev(ul, t2);
			if (if_block0) if_block0.m(ul, null);
			append_dev(ul, t3);
			append_dev(ul, li1);
			mount_component(menusociallinks, li1, null);
			append_dev(ul, t4);
			if (if_block1) if_block1.m(ul, null);
			/*ul_binding*/ ctx[19](ul);
			append_dev(header, t5);

			if (heading_slot) {
				heading_slot.m(header, null);
			}

			insert_dev(target, t6, anchor);

			if (default_slot) {
				default_slot.m(target, anchor);
			}

			insert_dev(target, t7, anchor);
			if (if_block2) if_block2.m(target, anchor);
			insert_dev(target, if_block2_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen_dev(window_1, "keydown", /*handleKeydown*/ ctx[15], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, [dirty]) {
			if (/*pdfAvailable*/ ctx[8]) if_block0.p(ctx, dirty);
			const menusociallinks_changes = {};
			if (dirty & /*articleData*/ 1) menusociallinks_changes.articleData = /*articleData*/ ctx[0];
			menusociallinks.$set(menusociallinks_changes);
			if (/*menuLinks*/ ctx[7] && /*menuLinks*/ ctx[7].length) if_block1.p(ctx, dirty);

			if (heading_slot) {
				if (heading_slot.p && (!current || dirty & /*$$scope*/ 65536)) {
					update_slot(heading_slot, heading_slot_template, ctx, /*$$scope*/ ctx[16], !current ? -1 : dirty, get_heading_slot_changes, get_heading_slot_context);
				}
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 65536)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[16], !current ? -1 : dirty, null, null);
				}
			}

			if (!/*mounted*/ ctx[1]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty & /*mounted*/ 2) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block$1(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(logonature.$$.fragment, local);
			transition_in(if_block0);
			transition_in(menusociallinks.$$.fragment, local);
			transition_in(if_block1);
			transition_in(heading_slot, local);
			transition_in(default_slot, local);
			transition_in(if_block2);
			current = true;
		},
		o: function outro(local) {
			transition_out(logonature.$$.fragment, local);
			transition_out(if_block0);
			transition_out(menusociallinks.$$.fragment, local);
			transition_out(if_block1);
			transition_out(heading_slot, local);
			transition_out(default_slot, local);
			transition_out(if_block2);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(a0);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(header);
			destroy_component(logonature);
			if (if_block0) if_block0.d();
			destroy_component(menusociallinks);
			if (if_block1) if_block1.d();
			/*ul_binding*/ ctx[19](null);
			if (heading_slot) heading_slot.d(detaching);
			if (detaching) detach_dev(t6);
			if (default_slot) default_slot.d(detaching);
			if (detaching) detach_dev(t7);
			if (if_block2) if_block2.d(detaching);
			if (detaching) detach_dev(if_block2_anchor);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let $menuElement;
	let $menuHeight;
	validate_store(menuElement, "menuElement");
	component_subscribe($$self, menuElement, $$value => $$invalidate(5, $menuElement = $$value));
	validate_store(menuHeight, "menuHeight");
	component_subscribe($$self, menuHeight, $$value => $$invalidate(6, $menuHeight = $$value));
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Menu", slots, ['heading','default']);
	let { articleData } = $$props;
	let { menuLinks, pdfAvailable, doi } = articleData;
	let logoHeight = 1.6;
	let mounted = false;
	let menuIsExpanded = true;
	let menuLinkIsFocused = false;
	let buttonIsFocused = false;
	let lastMenuLinkElem = null;
	let handleButtonBlur;

	let closeMenu = () => {
		$$invalidate(2, menuIsExpanded = false);
	};

	let focusButton = () => {
		buttonElement.focus();
	};

	let handleButtonClick = () => {
		$$invalidate(2, menuIsExpanded = !menuIsExpanded);
	};

	let handleMenuLinkFocus = () => {
		menuLinkIsFocused = true;
	};

	let handleButtonFocus = () => {
		buttonIsFocused = true;
	};

	let handleMenuLinkBlur = event => {
		menuLinkIsFocused = false;

		if (event.target === lastMenuLinkElem) {
			closeMenu();
		}
	};

	let handleKeydown = event => {
		let { key } = event;
		let escapeIsPressed = key === "Escape";
		let menuLinkOrButtonAreFocused = menuLinkIsFocused || buttonIsFocused;

		if (escapeIsPressed && menuIsExpanded && menuLinkOrButtonAreFocused) {
			closeMenu();
			focusButton();
		}
	};

	onMount(() => {
		$$invalidate(1, mounted = true);
		$$invalidate(2, menuIsExpanded = false);

		// `window` is not available for static render,
		// so wait till onMount to define this function
		// 'blur' event doesn't seem to fire on firefox using MocOS using mouse clicks
		// https://github.com/facebook/react/issues/12993#issuecomment-413949427
		$$invalidate(4, handleButtonBlur = () => {
			window.setTimeout(
				() => {
					if (!menuLinkIsFocused) {
						closeMenu();
					}
				},
				0
			);
		});
	});

	const writable_props = ["articleData"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Menu> was created with unknown prop '${key}'`);
	});

	function menulist_lastMenuLinkElem_binding(value) {
		lastMenuLinkElem = value;
		$$invalidate(3, lastMenuLinkElem);
	}

	function ul_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			$menuElement = $$value;
			menuElement.set($menuElement);
		});
	}

	$$self.$$set = $$props => {
		if ("articleData" in $$props) $$invalidate(0, articleData = $$props.articleData);
		if ("$$scope" in $$props) $$invalidate(16, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({
		onMount,
		menuElement,
		menuHeight,
		MenuList,
		MenuListStatic,
		MenuSocialLinks,
		ExpandButton,
		LogoNature,
		MenuPdfDownload,
		articleData,
		menuLinks,
		pdfAvailable,
		doi,
		logoHeight,
		mounted,
		menuIsExpanded,
		menuLinkIsFocused,
		buttonIsFocused,
		lastMenuLinkElem,
		handleButtonBlur,
		closeMenu,
		focusButton,
		handleButtonClick,
		handleMenuLinkFocus,
		handleButtonFocus,
		handleMenuLinkBlur,
		handleKeydown,
		$menuElement,
		$menuHeight
	});

	$$self.$inject_state = $$props => {
		if ("articleData" in $$props) $$invalidate(0, articleData = $$props.articleData);
		if ("menuLinks" in $$props) $$invalidate(7, menuLinks = $$props.menuLinks);
		if ("pdfAvailable" in $$props) $$invalidate(8, pdfAvailable = $$props.pdfAvailable);
		if ("doi" in $$props) $$invalidate(9, doi = $$props.doi);
		if ("logoHeight" in $$props) $$invalidate(10, logoHeight = $$props.logoHeight);
		if ("mounted" in $$props) $$invalidate(1, mounted = $$props.mounted);
		if ("menuIsExpanded" in $$props) $$invalidate(2, menuIsExpanded = $$props.menuIsExpanded);
		if ("menuLinkIsFocused" in $$props) menuLinkIsFocused = $$props.menuLinkIsFocused;
		if ("buttonIsFocused" in $$props) buttonIsFocused = $$props.buttonIsFocused;
		if ("lastMenuLinkElem" in $$props) $$invalidate(3, lastMenuLinkElem = $$props.lastMenuLinkElem);
		if ("handleButtonBlur" in $$props) $$invalidate(4, handleButtonBlur = $$props.handleButtonBlur);
		if ("closeMenu" in $$props) closeMenu = $$props.closeMenu;
		if ("focusButton" in $$props) focusButton = $$props.focusButton;
		if ("handleButtonClick" in $$props) $$invalidate(11, handleButtonClick = $$props.handleButtonClick);
		if ("handleMenuLinkFocus" in $$props) $$invalidate(12, handleMenuLinkFocus = $$props.handleMenuLinkFocus);
		if ("handleButtonFocus" in $$props) $$invalidate(13, handleButtonFocus = $$props.handleButtonFocus);
		if ("handleMenuLinkBlur" in $$props) $$invalidate(14, handleMenuLinkBlur = $$props.handleMenuLinkBlur);
		if ("handleKeydown" in $$props) $$invalidate(15, handleKeydown = $$props.handleKeydown);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		articleData,
		mounted,
		menuIsExpanded,
		lastMenuLinkElem,
		handleButtonBlur,
		$menuElement,
		$menuHeight,
		menuLinks,
		pdfAvailable,
		doi,
		logoHeight,
		handleButtonClick,
		handleMenuLinkFocus,
		handleButtonFocus,
		handleMenuLinkBlur,
		handleKeydown,
		$$scope,
		slots,
		menulist_lastMenuLinkElem_binding,
		ul_binding
	];
}

class Menu extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$1, create_fragment$1, safe_not_equal, { articleData: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Menu",
			options,
			id: create_fragment$1.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*articleData*/ ctx[0] === undefined && !("articleData" in props)) {
			console.warn("<Menu> was created without expected prop 'articleData'");
		}
	}

	get articleData() {
		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set articleData(value) {
		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

// The initial value is false as we don't know what the
// readers preferences will be
const allowAnimation = writable(false);

/* src/App.svelte generated by Svelte v3.38.3 */
const file = "src/App.svelte";

// (54:8) {#if mounted}
function create_if_block(ctx) {
	let p;
	let t;

	const block = {
		c: function create() {
			p = element("p");
			t = text("NB: The javascript has loaded.");
			this.h();
		},
		l: function claim(nodes) {
			p = claim_element(nodes, "P", {});
			var p_nodes = children(p);
			t = claim_text(p_nodes, "NB: The javascript has loaded.");
			p_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			add_location(p, file, 54, 10, 1292);
		},
		m: function mount(target, anchor) {
			insert_dev(target, p, anchor);
			append_dev(p, t);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(p);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(54:8) {#if mounted}",
		ctx
	});

	return block;
}

// (51:6) <Stack>
function create_default_slot_2(ctx) {
	let p0;
	let t0;
	let t1;
	let p1;
	let t2;
	let t3;
	let if_block_anchor;
	let if_block = /*mounted*/ ctx[0] && create_if_block(ctx);

	const block = {
		c: function create() {
			p0 = element("p");
			t0 = text("Hello and welcome to the Nature immersive article template.");
			t1 = space();
			p1 = element("p");
			t2 = text("Please use these files to start your project.");
			t3 = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
			this.h();
		},
		l: function claim(nodes) {
			p0 = claim_element(nodes, "P", {});
			var p0_nodes = children(p0);
			t0 = claim_text(p0_nodes, "Hello and welcome to the Nature immersive article template.");
			p0_nodes.forEach(detach_dev);
			t1 = claim_space(nodes);
			p1 = claim_element(nodes, "P", {});
			var p1_nodes = children(p1);
			t2 = claim_text(p1_nodes, "Please use these files to start your project.");
			p1_nodes.forEach(detach_dev);
			t3 = claim_space(nodes);
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
			this.h();
		},
		h: function hydrate() {
			add_location(p0, file, 51, 8, 1132);
			add_location(p1, file, 52, 8, 1207);
		},
		m: function mount(target, anchor) {
			insert_dev(target, p0, anchor);
			append_dev(p0, t0);
			insert_dev(target, t1, anchor);
			insert_dev(target, p1, anchor);
			append_dev(p1, t2);
			insert_dev(target, t3, anchor);
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, dirty) {
			if (/*mounted*/ ctx[0]) {
				if (if_block) ; else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(p0);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(p1);
			if (detaching) detach_dev(t3);
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_2.name,
		type: "slot",
		source: "(51:6) <Stack>",
		ctx
	});

	return block;
}

// (50:4) <Center>
function create_default_slot_1(ctx) {
	let stack;
	let current;

	stack = new Stack({
			props: {
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(stack.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(stack.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(stack, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const stack_changes = {};

			if (dirty & /*$$scope, mounted*/ 9) {
				stack_changes.$$scope = { dirty, ctx };
			}

			stack.$set(stack_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(stack.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(stack.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(stack, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot_1.name,
		type: "slot",
		source: "(50:4) <Center>",
		ctx
	});

	return block;
}

// (44:0) <Menu articleData="{articleData}">
function create_default_slot(ctx) {
	let main;
	let center;
	let current;

	center = new Center({
			props: {
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			main = element("main");
			create_component(center.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			main = claim_element(nodes, "MAIN", { id: true, tabindex: true, class: true });
			var main_nodes = children(main);
			claim_component(center.$$.fragment, main_nodes);
			main_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(main, "id", "main-content");
			attr_dev(main, "tabindex", "-1");
			attr_dev(main, "class", "svelte-19032c");
			add_location(main, file, 48, 2, 1058);
		},
		m: function mount(target, anchor) {
			insert_dev(target, main, anchor);
			mount_component(center, main, null);
			current = true;
		},
		p: function update(ctx, dirty) {
			const center_changes = {};

			if (dirty & /*$$scope, mounted*/ 9) {
				center_changes.$$scope = { dirty, ctx };
			}

			center.$set(center_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(center.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(center.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(main);
			destroy_component(center);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot.name,
		type: "slot",
		source: "(44:0) <Menu articleData=\\\"{articleData}\\\">",
		ctx
	});

	return block;
}

// (45:2) 
function create_heading_slot(ctx) {
	let div;
	let heading;
	let current;

	heading = new Heading({
			props: { articleData: /*articleData*/ ctx[1] },
			$$inline: true
		});

	const block = {
		c: function create() {
			div = element("div");
			create_component(heading.$$.fragment);
			this.h();
		},
		l: function claim(nodes) {
			div = claim_element(nodes, "DIV", { slot: true });
			var div_nodes = children(div);
			claim_component(heading.$$.fragment, div_nodes);
			div_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(div, "slot", "heading");
			add_location(div, file, 44, 2, 981);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			mount_component(heading, div, null);
			current = true;
		},
		p: noop,
		i: function intro(local) {
			if (current) return;
			transition_in(heading.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(heading.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			destroy_component(heading);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_heading_slot.name,
		type: "slot",
		source: "(45:2) ",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let head;
	let t0;
	let menu;
	let t1;
	let footer;
	let current;

	head = new Head({
			props: { articleData: /*articleData*/ ctx[1] },
			$$inline: true
		});

	menu = new Menu({
			props: {
				articleData: /*articleData*/ ctx[1],
				$$slots: {
					heading: [create_heading_slot],
					default: [create_default_slot]
				},
				$$scope: { ctx }
			},
			$$inline: true
		});

	footer = new Footer({ $$inline: true });

	const block = {
		c: function create() {
			create_component(head.$$.fragment);
			t0 = space();
			create_component(menu.$$.fragment);
			t1 = space();
			create_component(footer.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(head.$$.fragment, nodes);
			t0 = claim_space(nodes);
			claim_component(menu.$$.fragment, nodes);
			t1 = claim_space(nodes);
			claim_component(footer.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(head, target, anchor);
			insert_dev(target, t0, anchor);
			mount_component(menu, target, anchor);
			insert_dev(target, t1, anchor);
			mount_component(footer, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const menu_changes = {};

			if (dirty & /*$$scope, mounted*/ 9) {
				menu_changes.$$scope = { dirty, ctx };
			}

			menu.$set(menu_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(head.$$.fragment, local);
			transition_in(menu.$$.fragment, local);
			transition_in(footer.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(head.$$.fragment, local);
			transition_out(menu.$$.fragment, local);
			transition_out(footer.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(head, detaching);
			if (detaching) detach_dev(t0);
			destroy_component(menu, detaching);
			if (detaching) detach_dev(t1);
			destroy_component(footer, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("App", slots, []);
	let { data } = $$props;
	let { articleData } = data;
	let mounted = false;

	onMount(() => {
		$$invalidate(0, mounted = true);

		// allowAnimation should be true if the reader has set 'no-preference'
		// otherwise it should be false, and this should stop the animations
		// from being loaded
		let QUERY = "(prefers-reduced-motion: no-preference)";

		allowAnimation.set(window.matchMedia(QUERY).matches);
	});

	const writable_props = ["data"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("data" in $$props) $$invalidate(2, data = $$props.data);
	};

	$$self.$capture_state = () => ({
		onMount,
		Footer,
		Head,
		Heading,
		Menu,
		Stack,
		Center,
		allowAnimation,
		data,
		articleData,
		mounted
	});

	$$self.$inject_state = $$props => {
		if ("data" in $$props) $$invalidate(2, data = $$props.data);
		if ("articleData" in $$props) $$invalidate(1, articleData = $$props.articleData);
		if ("mounted" in $$props) $$invalidate(0, mounted = $$props.mounted);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [mounted, articleData, data];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance, create_fragment, safe_not_equal, { data: 2 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*data*/ ctx[2] === undefined && !("data" in props)) {
			console.warn("<App> was created without expected prop 'data'");
		}
	}

	get data() {
		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set data(value) {
		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

var articleData = {
	twitterHandle: "@nature",
	title: "Nature immersive article",
	description: "This is the description",
	headline: "Nature immersive article",
	stand: "This is the stand first",
	author: "Author Name",
	photographer: "Photographer Name",
	articleURL: "https://www.nature.com/articles/",
	immersiveURL: "https://www.nature.com/immersive/",
	doi: "d00000-000-00000-0",
	pdfAvailable: "false",
	altPdfAvailable: "false",
	altPdfBlurb: "",
	publishedAt: "1612915200",
	publishedAtString: "2021-02-10",
	menuLinks: [
		{
			text: "Link 1",
			href: "#"
		},
		{
			text: "Link 2",
			href: "#"
		},
		{
			text: "Link 3",
			href: "#"
		},
		{
			text: "Link 4",
			href: "#"
		}
	]
};
var data = {
	articleData: articleData
};

let app;

function init() {
  /* ---------------------------- Svelte component ---------------------------- */
  app = new App({
    target: document.querySelector("#statically-rendered-html"),
    props: {
      data,
    },
    hydrate: true,
  });
}

document.addEventListener("DOMContentLoaded", init);

var app$1 = app;

export default app$1;
//# sourceMappingURL=main.js.map
