(function(global) {
	'use strict';
	var $btn, $form, $form_email, $form_name, 
		$contribution_other, $contribution_other_km, $contribution_other_kc, $contribution_radios,
		current_pos_promise;

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

		$form.hide().removeClass('hidden');

		$form_email.validate = validate_email;
		$form_name.validate = validate_name;

		
		$btn.on('click', function() {
			$form.fadeIn('fast');
			$btn.prop('disabled', true);
		});

		$form.on('submit', function(ev) {
			var a, b, c;

			ev.preventDefault();
			
			a = check.call($form_email);
			b = check.call($form_name);
			c = check_contributions();

			if (a && b && c) {
				$.post('/donate', $form.serialize()).done(function(msg) {
					if (msg.success === true) {
						global.currentPos = msg.current_pos;
						global.mapAnimate();
					} else {
						alert(msg.errors.join('; '));
					}
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
			$contribution_other_km.text(num + ' km');
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
		})

	});

	current_pos_promise = $.getJSON('/current_pos').done(function(currentPos) {
		global.currentPos = currentPos;
	});
}(this));
