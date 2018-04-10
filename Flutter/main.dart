import 'package:flutter/material.dart';
import 'constants.dart' as constants;
import 'requester.dart' as requester;

void main() => runApp(new MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return new MaterialApp(
      title: 'Movies Today',
      home: new MoviesToday(),
    );
  }
}

class MoviesToday extends StatefulWidget {
  @override
  createState() => new MoviesState();
}

class MoviesState extends State<MoviesToday> {

  List data;

  @override
  void initState() {
    requester.fetchData().then((result) {
      this.setState(() { data = result; });
    });
  }

  @override
  Widget build(BuildContext context) {
    return new Scaffold(
      appBar: new AppBar(
        title: new Text('Now in Cinema'),
      ),
      body: _buildSuggestions(),
    );
  }

  Widget _buildSuggestions() {
    return new ListView.builder(
      itemCount: data == null ? 0 : data.length,
      itemBuilder: (BuildContext context, int index) {
        return new Card(
          child: new Column(
    mainAxisSize: MainAxisSize.min,
    children: <Widget>[
      new ListTile(
        title: new Text(
          data[index]["title"],
          style: new TextStyle(fontWeight: FontWeight.bold, fontSize: 20.0),
        ),
        subtitle: new Image.network(constants.imagePrefix + data[index]["poster_path"],),
      ),
      new ButtonTheme.bar(
        child: new ButtonBar(
          children: <Widget>[
            new FlatButton(
              child: const Text('Show More'),
              onPressed: () {this.showMore(data[index]);},
            ),
          ],
        ),
      ),
    ],
  ),
        );
      },
    );
  }

  void showMore(film) {
  Navigator.of(context).push(new PageRouteBuilder(
  opaque: false,
  pageBuilder: (BuildContext context, _, __) {
    return new Scaffold(
            appBar: new AppBar(
              title: new Text(film["original_title"]),
            ),
            body: new Column(
              children: <Widget>[
                new Image.network(constants.imagePrefix + film["backdrop_path"]),
                new Text("Rating: ${film["vote_average"]}"),
                new Text("Overview: ${film["overview"]}")
                ],
            )
        );
  },
  transitionsBuilder: (_, Animation<double> animation, __, Widget child) {
    return new FadeTransition(
      opacity: animation,
      child: child
    );
  }
));
}}
