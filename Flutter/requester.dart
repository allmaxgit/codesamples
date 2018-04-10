import 'dart:async';
import 'package:http/http.dart' as http;
import 'constants.dart' as constants;
import 'dart:convert';

Future<List> fetchData() async {
  http.Response response = await http.get(
      constants.movieDB,
      headers: {
        "Accept": "applciation/json"
      }
    );
  return JSON.decode(response.body)["results"];
}
