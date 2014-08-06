(function(global) {
	'use strict';
	var $btn, $form, $form_email, $form_name, 
		$contribution_other, $contribution_other_km, $contribution_other_kc, $contribution_radios,
		current_pos_promise,
		messanger,

		KOEF = 5;

	function str(msg) {
		try {
			if (typeof msg === "object") {
				return JSON.stringify(msg);
			}
			return msg.toString();
		} catch (e) {}

		return msg;
	}
	
	function Messanger() {
		this.$el = $('#messanger');

		this.success = function(msg) {
			this.$el.append($("<div class='msg msg-success' />").text(str(msg)));
		}

		this.error = function(msg) {
			this.$el.append($("<div class='msg msg-error' />").text(str(msg)));
		}

		this.info = function(msg) {
			this.$el.append($("<div class='msg msg-info' />").text(str(msg)));
		}
	}

	function validate_email() {
		return this.val().match(/^.+@.+$/);
	}

	function validate_name() {
		return !!this.val();
	}

	function validate_contribution_other() {
		return this.val().match(/^[0-9]+$/) && this.val() > 0;
	}

	function check() {
		var valid = !this.validate || this.validate();

		this.toggleClass('error', !valid);

		return !!valid;
	}

	function check_contributions() {
		var valid = $contribution_radios.filter(':checked').length > 0 || $contribution_other.validate();

		$contribution_other.closest('fieldset').toggleClass('error', !valid);

		return !!valid;
	}


	$(function() {
		$btn = $('.btn-big');
		$form = $('form');
		$form_email = $("#form-email");
		$form_name = $("#form-name");
		
		messanger = new Messanger();
		global.messanger = messanger;

		$form.hide().removeClass('hidden');

		$form_email.validate = validate_email;
		$form_name.validate = validate_name;

		
		$btn.on('click', function() {
			$form.fadeIn('fast');
			$btn.prop('disabled', true);
			$(window).scrollTo($form, 1000);
		});

		$form.on('submit', function(ev) {
			var a, b, c;

			ev.preventDefault();
			
			a = check.call($form_email);
			b = check.call($form_name);
			c = check_contributions();

			if (a && b && c) {
				$form.find('input[type="submit"]').prop('disabled', true);

				$.post('/donate', $form.serialize()).done(function(msg) {
					if (msg.success === true) {
						$form.fadeOut('fast');

						global.currentPos = msg.current_pos;
						global.mapAnimate();

						messanger.success("Děkujeme, že jste nás posunuli.");
					} else {
						messanger.error(msg.errors);
					}
				}).fail(function() {
					messanger.error("Nastala chyba v komunikacii so serverom");
				}).always(function() {
					$form.find('input[type="submit"]').prop('disabled', false);
				});
			}
		});

		$form_email.on('change', function() { 
			check.call($form_email);
		});
		$form_name.on('change', function() {
			check.call($form_name);
		});

		$contribution_other = $('#form-contr-other');
		$contribution_other_km = $('#contr-other-km');
		$contribution_other_kc = $('#contr-other-kc');
		$contribution_radios = $('input[name="contribution"]');

		$contribution_other.validate = validate_contribution_other;
		$contribution_other.on('keyup', function() {
			var num = parseInt($contribution_other.val(), 10);
			
			if (isNaN(num) || num < 0) num = 0;
			$contribution_other_km.text(num / KOEF + ' km');
			$contribution_other_kc.html('<span>' + $contribution_other.val() + '</span> Kč');
		}).on('keydown', function() {
			$contribution_other_kc.html('');
		}).on('focus', function() {
			$contribution_radios.prop('checked', false);
		}).on('change', function() {
			check_contributions();
		});

		$contribution_radios.on('change', function() {
			check_contributions();
		});

		$("#map").waypoint(function() {
			current_pos_promise.done(function() {
				global.mapAnimate();
			});
		}, {
			offset: function() {
				return $(window).height() - $(this).height();
			},
			triggerOnce: true
		});

	});

	current_pos_promise = $.getJSON('/current_pos').done(function(currentPos) {
		global.currentPos = currentPos;
	});
}(this));
