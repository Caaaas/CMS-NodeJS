var CodeClass = Quill.import('formats/code');
var FontClass = Quill.import('attributors/class/font');
var SizeClass = Quill.import('attributors/class/size');
var DirectionClass = Quill.import('attributors/class/direction')
Quill.register(CodeClass, false);
Quill.register(FontClass, false);
Quill.register(SizeClass, false);
Quill.register(DirectionClass, false);

var toolbarOptions = [
    [{'header': [1, 2, 3, 4, 5, 6, false]}],

    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons

    [{'color': []}, {'background': []}],          // dropdown with defaults from theme

    ['blockquote', 'code-block'],

    [{'list': 'ordered'}, {'list': 'bullet'}],
    [{'script': 'sub'}, {'script': 'super'}],
    [{'indent': '-1'}, {'indent': '+1'}],

    [{'align': ''}, {'align': 'center'}, {'align': 'right'}, {'align': 'justify'}],

    ['link', 'video', 'image', 'formula'],

    ['clean']
];

var quill = new Quill('#editor', {
    modules: {
        toolbar: toolbarOptions
    },
    placeholder: 'Skriv ditt inlägg här...',
    theme: 'snow'
});
