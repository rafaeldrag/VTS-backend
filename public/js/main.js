/*scroll to top*/

$(document).ready(function () {
    $(function () {
        $.scrollUp({
            scrollName: 'scrollUp', // Element ID
            scrollDistance: 300, // Distance from top/bottom before showing element (px)
            scrollFrom: 'top', // 'top' or 'bottom'
            scrollSpeed: 300, // Speed back to top (ms)
            easingType: 'linear', // Scroll to top easing (see http://easings.net/)
            animation: 'fade', // Fade, slide, none
            animationSpeed: 200, // Animation in speed (ms)
            scrollTrigger: false, // Set a custom triggering element. Can be an HTML string or jQuery object
            //scrollTarget: false, // Set a custom target element for scrolling to the top
            scrollText: '<i class="fa fa-angle-up"></i>', // Text for element, can contain HTML
            scrollTitle: false, // Set a custom <a> title if required.
            scrollImg: false, // Set true to use image
            activeOverlay: false, // Set CSS color to display scrollUp active point, e.g '#00FFFF'
            zIndex: 2147483647 // Z-Index for the overlay
        });
    });
});


function initMap() {
    map = new google.maps.Map(document.getElementById('gmap'), {
        center: {lat: 60.222, lng: 24.805},
        zoom: 15
    });

    var marker = new google.maps.Marker({
        position: {lat: 60.2215, lng: 24.8078},
        map: map,
        title: 'aStore Inc.'
    });
    marker.setMap(map);

    var contentString = '<b>aStore Inc.</b>' +
        '<p>aStore is a leading online retailer committed<br>' +
        'to becoming the most loved and trusted marketplace<br>' +
        'on the web.</p>' +
        '<p>Address: Vanha maantie 6 - 02650 Espoo - Finland<br>' +
        'Tel: Mr. Anh Pham 012-3456789</p>';
    var infoWindows = new google.maps.InfoWindow({
        content: contentString
    });
    infoWindows.open(map, marker);
}
//plugin bootstrap minus and plus
//http://jsfiddle.net/laelitenetwork/puJ6G/
$('.sign-up-login').click(function(e) {
        e.preventDefault();
        if (window.location.href.includes('checkout'))
            window.location = '/sign-up-checkout';
        else
            window.location = '/sign-up';

})
$('.btn-number').click(function(e){
    e.preventDefault();

    var fieldName = $(this).attr('data-field');
    var type      = $(this).attr('data-type');
    var input = $("input[name='"+fieldName+"']");
    var currentVal = parseInt(input.val());
    if (!isNaN(currentVal)) {
        if(type == 'minus') {

            if(currentVal > input.attr('min')) {
                input.val(currentVal - 1).change();
            }
            if(parseInt(input.val()) == 1) {
                $(this).attr('disabled', true);
            }

        } else if(type == 'plus') {
                $('.input-group-btn.minus button').attr('disabled', false);
                input.val(currentVal + 1).change();
        }
    } else {
        input.val(0);
    }
});

let updateTotal = () => {
    let prices = $('.cart_total_price');
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
        price = Number($(prices[i]).text().split('R$ ')[1]);
        sum += price;
    }
    $('.sub-total').text('R$ ' + sum.toFixed(2))
    $('.total').text('R$ ' + sum.toFixed(2))

}
$('.btn-plus').click((event) => {
    let id = $(event.target).closest('form').attr('name');
    let qty = Number($(event.target).closest('form').find('input').val());
    let body = {};
    body[id] = qty;
    $.post( '/cart/' + id + '/update', body)
    .done(function( data ) {
    //alert( "Data Loaded: " + data );
  });
  let current_price = Number($(event.target).closest('tr').find('.cart_total_price').text().split('R$ ')[1]);
  let final_price = current_price * qty/(qty - 1);
  $(event.target).closest('tr').find('.cart_total_price').text('R$ ' + final_price.toFixed(2));
  updateTotal();
    // $(event.target).closest('form').submit();
})

$('.btn-minus').click((event) => {
    let id = $(event.target).closest('form').attr('name');
    let qty = Number($(event.target).closest('form').find('input').val());
    let body = {};
    body[id] = qty;
    $.post( '/cart/' + id + '/update', body)
    .done(function( data ) {
    //alert( "Data Loaded: " + data );
  });
  let current_price = Number($(event.target).closest('tr').find('.cart_total_price').text().split('R$ ')[1]);
  let final_price = current_price * qty/(qty + 1);
  $(event.target).closest('tr').find('.cart_total_price').text('R$ ' + final_price.toFixed(2));
  updateTotal();
    // $(event.target).closest('form').submit();
})


$( ".cart_quantity_input" ).change((event) => {
    // $(event.target).closest('form').submit();
});
$('.add-more-products').click((event) => {
    window.location = '/';
});

var check = function() {
    if (document.getElementById('input-password').value.length < 6)
        {
             document.getElementById('sign-up-submit-btn').disabled = true;
             $('#sign-up-message').text('Senha fraca. Use pelo menos 6 caracteres.')
        }
    else if (!document.getElementById('input-password').value.match(/[a-z]+/) &&
            !document.getElementById('input-password').value.match(/[A-Z]+/) )
        {
             document.getElementById('sign-up-submit-btn').disabled = true;
            $('#sign-up-message').text('Senha fraca. Use pelo menos uma letra.')
        }
        else if (!document.getElementById('input-password').value.match(/[0-9]+/))
            {
                 document.getElementById('sign-up-submit-btn').disabled = true;
                $('#sign-up-message').text('Senha fraca. Use pelo menos um número.')
            }
    else if (document.getElementById('input-password').value ==
             document.getElementById('input-confirm-password').value) {
         document.getElementById('sign-up-submit-btn').disabled = false;
         $('#sign-up-message').text('')

     } else {
         $('#sign-up-message').text('Senhas distintas.')
         document.getElementById('sign-up-submit-btn').disabled = true;
     }
}

$('#input-password').change(check);

$('#input-confirm-password').change(check);

$("input[name='inlineRadioOptions']").click(function(){
     var radioValue = $("input[name='inlineRadioOptions']:checked").val();
     if (radioValue == 'Retirar na Loja')
        $('div.deliveryAddress').hide();
    else
        $('div.deliveryAddress').show();

});
$("#sign-up-zip").blur(function() {

        //Nova variável "cep" somente com dígitos.
        var cep = $(this).val().replace(/\D/g, '');

        //Verifica se campo cep possui valor informado.
        if (cep != "") {

            //Expressão regular para validar o CEP.
            var validacep = /^[0-9]{8}$/;

            //Valida o formato do CEP.
            if(validacep.test(cep)) {

                //Preenche os campos com "..." enquanto consulta webservice.
                $("#street").val("...");
                $("#neighborhood").val("...");
                $("#city").val("...");
                $("#state").val("...");
                // $("#ibge").val("...");

                //Consulta o webservice viacep.com.br/
                $.getJSON("https://viacep.com.br/ws/"+ cep +"/json/?callback=?", function(dados) {

                    if (!("erro" in dados)) {
                        //Atualiza os campos com os valores da consulta.
                        $("#street").val(dados.logradouro);
                        $("#neighbourhood").val(dados.bairro);
                        $("#city").val(dados.localidade);
                        $("#state").val(dados.uf);
                        $("#ibge").val(dados.ibge);
                    } //end if.
                    else {
                        //CEP pesquisado não foi encontrado.
                        limpa_formulário_cep();
                        alert("CEP não encontrado.");
                    }
                });
            } //end if.
            else {
                //cep é inválido.
                limpa_formulário_cep();
                alert("Formato de CEP inválido.");
            }
        } //end if.
        else {
            //cep sem valor, limpa formulário.
            limpa_formulário_cep();
        }
    });
/*$('.input-number').focusin(function(){
   $(this).data('oldValue', $(this).val());
});
$('.input-number').change(function() {

    minValue =  parseInt($(this).attr('min'));
    maxValue =  parseInt($(this).attr('max'));
    valueCurrent = parseInt($(this).val());

    name = $(this).attr('name');
    if(valueCurrent >= minValue) {
        $(".btn-number[data-type='minus'][data-field='"+name+"']").removeAttr('disabled')
    } else {
        alert('Sorry, the minimum value was reached');
        $(this).val($(this).data('oldValue'));
    }
    if(valueCurrent <= maxValue) {
        $(".btn-number[data-type='plus'][data-field='"+name+"']").removeAttr('disabled')
    } else {
        alert('Sorry, the maximum value was reached');
        $(this).val($(this).data('oldValue'));
    }


});
$(".input-number").keydown(function (e) {
        // Allow: backspace, delete, tab, escape, enter and .
        if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 190]) !== -1 ||
             // Allow: Ctrl+A
            (e.keyCode == 65 && e.ctrlKey === true) ||
             // Allow: home, end, left, right
            (e.keyCode >= 35 && e.keyCode <= 39)) {
                 // let it happen, don't do anything
                 return;
        }
        // Ensure that it is a number and stop the keypress
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    });*/
    // $('#sign-up').validator();
