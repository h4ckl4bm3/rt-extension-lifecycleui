jQuery(function () {
    var Super = RT.LifecycleViewer;

    function Editor (container) {
        Super.call(this);
        this.padding = this.statusCircleRadius * 2;
    };
    Editor.prototype = Object.create(Super.prototype);

    Editor.prototype._initializeTemplates = function (container) {
        var self = this;

        Handlebars.registerHelper('select', function(value, options) {
            var node = jQuery('<select />').html( options.fn(this) );
            node.find('[value="' + value + '"]').attr({'selected':'selected'});
            return node.html();
        });

        Handlebars.registerHelper('canAddTransition', function(fromStatus, toStatus, lifecycle) {
            return !lifecycle.hasTransition(fromStatus, toStatus);
        });

        Handlebars.registerHelper('canSelectTransition', function(fromStatus, toStatus, lifecycle) {
            return lifecycle.hasTransition(fromStatus, toStatus);
        });

        var templates = {};
        self.container.find('script.lifecycle-inspector-template').each(function () {
            var type = jQuery(this).data('type');
            var template = jQuery(this).html();
            var fn = Handlebars.compile(template);
            templates[type] = fn;
        });
        return templates;
    };

    Editor.prototype.setInspectorContent = function (node) {
        var self = this;
        var lifecycle = self.lifecycle;
        var inspector = self.inspector;

        var type = node ? node._type : 'canvas';

        var params = { lifecycle: lifecycle };
        params[type] = node;

        inspector.html(self.templates[type](params));
        inspector.find('sf-menu').supersubs().superfish({ dropShadows: false, speed: 'fast', delay: 0 }).supposition()

        inspector.find(':input').change(function () {
            var field = this.name;
            var value = jQuery(this).val();
            lifecycle.updateItem(node, field, value);
            self.refreshDisplay();
        });

        inspector.find('button.change-color').click(function (e) {
            e.preventDefault();
            var picker = jQuery('<div class="color-picker"></div>');
            jQuery(this).replaceWith(picker);

            var skipUpdateCallback = 0;
            var farb = jQuery.farbtastic(picker, function (newColor) {
                if (skipUpdateCallback) {
                    return;
                }
                inspector.find('.status-color').val(newColor);
                lifecycle.updateItem(node, 'color', newColor);
                self.refreshDisplay();
            });
            farb.setColor(node.color);

            var input = jQuery('<input class="status-color" size=8 maxlength=7>');
            inspector.find('.status-color').replaceWith(input);
            input.on('input', function () {
                var newColor = input.val();
                if (newColor.match(/^#[a-fA-F0-9]{6}$/)) {
                    skipUpdateCallback = 1;
                    farb.setColor(newColor);
                    skipUpdateCallback = 0;

                    lifecycle.updateItem(node, 'color', newColor);
                    self.refreshDisplay();
                }
            });
            input.val(node.color);
        });

        inspector.find('button.delete').click(function (e) {
            e.preventDefault();
            lifecycle.deleteItemForKey(node._key);

            self.deselectAll(true);
            self.refreshDisplay();
        });

        inspector.find('a.add-transition').click(function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            lifecycle.addTransition(fromStatus, toStatus);

            button.closest('li').addClass('hidden');

            inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

            self.refreshDisplay();
            self.selectStatus(node.name);
        });

        inspector.find('a.select-status').on('click', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            self.selectStatus(statusName);
        });

        inspector.find('a.select-transition').on('click', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            self.selectTransition(fromStatus, toStatus);
        });
    };

    Editor.prototype.deselectAll = function (clearSelection) {
        Super.prototype.deselectAll.call(this);
        if (clearSelection) {
            this.setInspectorContent(null);
        }
    };

    Editor.prototype.selectStatus = function (name) {
        var d = Super.prototype.selectStatus.call(this, name);
        this.setInspectorContent(d);
    };

    Editor.prototype.selectTransition = function (fromStatus, toStatus) {
        var d = Super.prototype.selectTransition.call(this, fromStatus, toStatus);
        this.setInspectorContent(d);
    };

    Editor.prototype.selectDecoration = function (key) {
        var d = Super.prototype.selectDecoration.call(this, key);
        this.setInspectorContent(d);
    };

    Editor.prototype.initializeEditor = function (node, config) {
        var self = this;
        self.initializeViewer(node, config);

        self.templates = self._initializeTemplates(self.container);
        self.inspector = self.container.find('.inspector');

        self.setInspectorContent(null);

        jQuery('form[name=ModifyLifecycle]').submit(function (e) {
            var config = lifecycle.exportAsConfiguration();
            e.preventDefault();
            return false;
        });
    };

    RT.LifecycleEditor = Editor;
});
